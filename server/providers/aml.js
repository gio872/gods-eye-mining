import { createHash } from 'node:crypto';

const OFAC_SDN_URL = 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML';
const OFAC_CONSOLIDATED_URL = 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/CONSOLIDATED.XML';
const UN_CONSOLIDATED_URL = 'https://scsanctions.un.org/resources/xml/en/consolidated.xml';
const GLEIF_URL = 'https://api.gleif.org/api/v1/lei-records';
const GDELT_URL = 'https://api.gdeltproject.org/api/v2/doc/doc';
const OPENSANCTIONS_URL = 'https://api.opensanctions.org/match/default';
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_CANDIDATES = 8;

const cache = new Map();

function normalize(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}
function tokenSet(value) {
  return new Set(normalize(value).split(/\s+/).filter((v) => v.length > 1));
}
function similarity(query, candidate) {
  const q = tokenSet(query);
  const c = tokenSet(candidate);
  if (!q.size || !c.size) return 0;
  let shared = 0;
  for (const token of q) if (c.has(token)) shared += 1;
  const overlap = shared / Math.max(q.size, c.size);
  const joinedQ = normalize(query);
  const joinedC = normalize(candidate);
  const containment = joinedC.includes(joinedQ) || joinedQ.includes(joinedC) ? 0.25 : 0;
  return Math.min(1, overlap + containment);
}
function fetchText(url, headers = {}) {
  return fetch(url, {
    headers: {
      'User-Agent': "GodsEyeView/AML; contact=admin",
      Accept: 'application/xml, text/xml, application/json;q=0.9, */*;q=0.5',
      ...headers,
    },
    redirect: 'follow',
  }).then(async (response) => {
    if (!response.ok) throw new Error(`Upstream HTTP ${response.status}: ${response.statusText}`);
    return response.text();
  });
}
async function cachedText(key, url) {
  const current = cache.get(key);
  if (current && Date.now() - current.at < CACHE_TTL_MS) return current.value;
  const value = await fetchText(url);
  cache.set(key, { at: Date.now(), value });
  return value;
}
function tagValues(xml, tag) {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, 'gi');
  return [...xml.matchAll(re)].map((m) => m[1].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"').trim()).filter(Boolean);
}
function extractSdnRecords(xml) {
  return [...xml.matchAll(/<(?:[\\w-]+:)?sdnEntry\\b[\\s\\S]*?<\/(?:[\\w-]+:)?sdnEntry>/gi)].map((m, index) => {
    const raw = m[0];
    const first = tagValues(raw, 'firstName')[0] || '';
    const last = tagValues(raw, 'lastName')[0] || '';
    const aliases = tagValues(raw, 'lastName').slice(1).map((v) => v.trim());
    const name = [first, last].filter(Boolean).join(' ') || tagValues(raw, 'name')[0] || `OFAC SDN ${index + 1}`;
    return {
      id: tagValues(raw, 'uid')[0] || `sdn-${index + 1}`,
      name,
      aliases,
      type: tagValues(raw, 'sdnType')[0] || 'unknown',
      programs: tagValues(raw, 'program').slice(0, 8),
    };
  });
}
function extractGenericRecords(xml) {
  const blocks = [...xml.matchAll(/<(?:[\\w-]+:)?(?:Entity|entity)\\b[\\s\\S]*?<\/(?:[\\w-]+:)?(?:Entity|entity)>/gi)].map((m) => m[0]);
  const records = blocks.length ? blocks : [xml];
  return records.flatMap((raw, index) => {
    const names = [
      ...tagValues(raw, 'wholeName'),
      ...tagValues(raw, 'name'),
      ...tagValues(raw, 'Name'),
      ...tagValues(raw, 'legalName'),
      ...tagValues(raw, 'lastName'),
      ...tagValues(raw, 'firstName'),
    ].filter(Boolean);
    const unique = [...new Set(names)].slice(0, 12);
    return unique.map((name, nameIndex) => ({
      id: `generic-${index + 1}-${nameIndex + 1}`,
      name,
      aliases: [],
      type: 'entity',
      programs: [],
    }));
  });
}
async function ofacCandidates(query, sourceId, url) {
  const xml = await cachedText(sourceId, url);
  const records = sourceId === 'ofac-sdn' ? extractSdnRecords(xml) : extractGenericRecords(xml);
  return records
    .map((record) => ({ ...record, score: similarity(query, record.name), source: sourceId }))
    .filter((record) => record.score >= 0.42)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES);
}
function openSanctionsConfigured() {
  return Boolean(String(process.env.OPENSANCTIONS_API_KEY || '').trim());
}
async function pepCandidates(query, entityType) {
  if (!openSanctionsConfigured()) return { configured: false, matches: [] };
  const schema = entityType === 'company' ? 'Company' : 'Person';
  const body = {
    queries: {
      q: {
        schema,
        properties: { name: [query] },
      },
    },
  };
  const response = await fetch(OPENSANCTIONS_URL + '?topics=role.pep&topics=role.rca&limit=8', {
    method: 'POST',
    headers: {
      Authorization: `ApiKey ${process.env.OPENSANCTIONS_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'GodsEyeView/AML',
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`OpenSanctions HTTP ${response.status}`);
  const results = payload?.responses?.q?.results || [];
  return {
    configured: true,
    matches: results.map((item) => ({
      id: item.id,
      name: item.caption,
      score: Number(item.score) || 0,
      match: Boolean(item.match),
      schema: item.schema,
      topics: item.properties?.topics || [],
      datasets: item.datasets || [],
      source: 'opensanctions-pep',
    })).slice(0, MAX_CANDIDATES),
  };
}
async function adverseMedia(query) {
  const params = new URLSearchParams({
    query: `"${query.replace(/"/g, ' ')}"`,
    mode: 'artlist',
    format: 'json',
    maxrecords: '20',
    timespan: '3months',
    sort: 'datedesc',
  });
  const response = await fetch(`${GDELT_URL}?${params}`, { headers: { Accept: 'application/json', 'User-Agent': 'GodsEyeView/AML' } });
  if (!response.ok) throw new Error(`GDELT HTTP ${response.status}`);
  const payload = await response.json();
  const articles = Array.isArray(payload?.articles) ? payload.articles : [];
  return articles.map((article) => ({
    title: article.title || '',
    url: article.url || '',
    domain: article.domain || '',
    language: article.language || '',
    publishedAt: article.seendate || article.datetime || null,
    source: 'gdelt-doc-2',
  })).filter((article) => article.title || article.url).slice(0, 20);
}
async function gleifSearch(query) {
  const params = new URLSearchParams();
  params.set('filter[entity.legalName]', query);
  params.set('page[size]', '8');
  const response = await fetch(`${GLEIF_URL}?${params}`, { headers: { Accept: 'application/vnd.api+json, application/json', 'User-Agent': 'GodsEyeView/AML' } });
  if (!response.ok) throw new Error(`GLEIF HTTP ${response.status}`);
  const payload = await response.json();
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows.map((row) => {
    const attrs = row.attributes || {};
    const entity = attrs.entity || {};
    return {
      lei: row.id,
      legalName: entity.legalName?.name || '',
      otherNames: entity.otherNames?.map?.((v) => v.name).filter(Boolean) || [],
      status: entity.status || null,
      jurisdiction: entity.jurisdiction || null,
      country: entity.legalAddress?.country || null,
      address: entity.legalAddress?.addressLines || [],
      parent: attrs.relationships?.parent || attrs.directParent || attrs.ultimateParent || null,
      source: 'gleif',
    };
  });
}

function sourceStatus() {
  return [
    { id: 'ofac-sdn', name: 'OFAC SDN', status: 'provider-ready', description: 'OFAC Sanctions List Service · XML' },
    { id: 'ofac-consolidated', name: 'OFAC Consolidated', status: 'provider-ready', description: 'OFAC Non-SDN Consolidated · XML' },
    { id: 'pep', name: 'PEP', status: openSanctionsConfigured() ? 'provider-ready' : 'configuration-required', description: openSanctionsConfigured() ? 'OpenSanctions PEP / RCA' : 'Configure OPENSANCTIONS_API_KEY' },
    { id: 'adverse-media', name: 'Adverse Media', status: 'provider-ready', description: 'GDELT DOC 2.0 · rolling 3 months' },
    { id: 'ubo', name: 'UBO / Ownership', status: 'provider-ready', description: 'GLEIF LEI Level 1/2 ownership data' },
  ];
}

export function amlProxy({ adminToken = process.env.GEM_AML_ADMIN_TOKEN || process.env.GEM_CAMERA_ADMIN_TOKEN || '' } = {}) {
  const install = (server) => {
    server.middlewares.use('/api/aml', async (req, res) => {
      const reply = (status, body) => {
        res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(body));
      };
      try {
        const url = new URL(req.url || '/', 'http://localhost');
        if (url.pathname === '/status' && req.method === 'GET') {
          return reply(200, { configured: Boolean(adminToken), sources: sourceStatus(), retrievedAt: new Date().toISOString() });
        }
        const bearer = String(req.headers?.authorization || '');
        const supplied = bearer.startsWith('Bearer ') ? bearer.slice(7).trim() : '';
        if (!adminToken) return reply(503, { error: 'GEM_AML_ADMIN_TOKEN or GEM_CAMERA_ADMIN_TOKEN is required' });
        if (supplied !== adminToken) return reply(401, { error: 'Invalid AML administrator token' });
        if (url.pathname === '/screen' && req.method === 'POST') {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const input = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          const query = String(input.query || '').trim().slice(0, 240);
          const entityType = input.entityType === 'company' ? 'company' : 'person';
          if (query.length < 2) throw new Error('A screening query requires at least 2 characters');
          const [sdn, consolidated, pep, media, ubo] = await Promise.allSettled([
            ofacCandidates(query, 'ofac-sdn', OFAC_SDN_URL),
            ofacCandidates(query, 'ofac-consolidated', OFAC_CONSOLIDATED_URL),
            pepCandidates(query, entityType),
            adverseMedia(query),
            gleifSearch(query),
          ]);
          return reply(200, {
            query,
            entityType,
            retrievedAt: new Date().toISOString(),
            sources: {
              ofacSdn: sdn.status === 'fulfilled' ? { status: 'ok', matches: sdn.value } : { status: 'error', error: sdn.reason?.message || String(sdn.reason) },
              ofacConsolidated: consolidated.status === 'fulfilled' ? { status: 'ok', matches: consolidated.value } : { status: 'error', error: consolidated.reason?.message || String(consolidated.reason) },
              pep: pep.status === 'fulfilled' ? { status: pep.value.configured ? 'ok' : 'not-configured', matches: pep.value.matches } : { status: 'error', error: pep.reason?.message || String(pep.reason) },
              adverseMedia: media.status === 'fulfilled' ? { status: 'ok', matches: media.value } : { status: 'error', error: media.reason?.message || String(media.reason) },
              ubo: ubo.status === 'fulfilled' ? { status: 'ok', matches: ubo.value } : { status: 'error', error: ubo.reason?.message || String(ubo.reason) },
            },
            methodology: 'Candidate screening only. Similarity values are analytical candidate scores, not legal conclusions or risk ratings. Review source records, identity attributes and dates before taking action.',
          });
        }
        return reply(404, { error: 'Not found' });
      } catch (error) {
        return reply(500, { error: error?.message || String(error) });
      }
    });
  };
  return { name: 'aml', configureServer: install, configurePreviewServer: install };
}
