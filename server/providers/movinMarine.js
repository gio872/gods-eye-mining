import { readResponseTextCapped } from './common/http.js';

const URLS = Object.freeze({
  mining: 'https://www.movinmarine.com/servicios/exploracion-minera/',
  radar: 'https://www.movinmarine.com/radar-aereo-m2/',
  method: 'https://www.movinmarine.com/prospeccion-geofisica-aplicada-a-investigaciones-mineras/',
  projects: 'https://www.movinmarine.com/proyectos/',
  dossier: 'https://www.movinmarine.com/pdf/MOVINMARINE-DOSIER-TECNICO-ES.pdf',
});
const TTL_MS = 30 * 60 * 1000;
const MAX_BYTES = 900_000;
const cache = new Map();

function decodeHtml(value) {
  return String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function headings(html) {
  return [...String(html ?? '').matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((match) => decodeHtml(match[1]))
    .filter(Boolean)
    .slice(0, 60);
}

function listItems(html) {
  return [...String(html ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => decodeHtml(match[1]))
    .filter((value) => value.length >= 3 && value.length <= 240)
    .slice(0, 100);
}

function extractEmails(text) {
  return [...new Set(String(text ?? '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])].slice(0, 30);
}

function extractKeywords(text) {
  const vocabulary = [
    'oro','cobre','zinc','tierras raras','REE','coltán','tantalita','litio','tungsteno',
    'geofísica','electromagnético','conductividad','microondas','radiometría','VLF',
    'profundidad','5.000 metros','2D','3D','agua','hidrocarburos','arqueología',
  ];
  const normalized = String(text ?? '').toLowerCase();
  return vocabulary.filter((term) => normalized.includes(term.toLowerCase()));
}

function summarizePage(url, html) {
  const text = decodeHtml(html);
  return {
    url,
    title: (String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] && decodeHtml(String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)[1])) || null,
    headings: headings(html),
    listItems: listItems(html),
    emails: extractEmails(text),
    keywords: extractKeywords(text),
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchPage(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.cachedAt < TTL_MS) return hit.value;
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8',
      'User-Agent': 'GodsEyeMining/ANM-MovinMarine-Reference',
    },
    signal: AbortSignal.timeout(15_000),
  });
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) throw new Error('MovinMarine HTTP ' + response.status);
  if (contentType.includes('pdf')) {
    return { url, contentType, fetchedAt: new Date().toISOString(), note: 'PDF disponible; consulta HTML usada para resumen vivo.' };
  }
  const html = await readResponseTextCapped(response, MAX_BYTES);
  const value = { contentType, ...summarizePage(url, html) };
  cache.set(url, { cachedAt: Date.now(), value });
  return value;
}

async function snapshot() {
  const pages = {};
  const errors = [];
  for (const [key, url] of Object.entries(URLS)) {
    try { pages[key] = await fetchPage(url); }
    catch (error) { errors.push({ key, url, error: String(error?.message || error) }); }
  }
  const text = Object.values(pages).map((page) => (page?.headings || []).join(' ') + ' ' + (page?.listItems || []).join(' ')).join(' ');
  return {
    provider: 'MovinMarine',
    technology: 'Radar Aéreo M2',
    status: errors.length === Object.keys(URLS).length ? 'UNAVAILABLE' : errors.length ? 'PARTIAL' : 'LIVE',
    fetchedAt: new Date().toISOString(),
    pages,
    keywords: extractKeywords(text),
    errors,
    disclaimer: 'Referencia pública de fabricante/empresa. No se incorpora como medición geológica de GEM.',
  };
}

export function movinMarineReferenceProxy() {
  const install = (server) => {
    server.middlewares.use('/api/movinmarine/reference', async (req, res) => {
      const reply = (status, body) => {
        res.writeHead(status, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        });
        res.end(JSON.stringify(body));
      };
      try {
        if (req.method !== 'GET') return reply(405, { error: 'GET required' });
        return reply(200, await snapshot());
      } catch (error) {
        return reply(502, {
          error: 'MovinMarine reference query failed',
          detail: String(error?.message || error).slice(0, 500),
        });
      }
    });
  };
  return {
    name: 'movinmarine-reference',
    configureServer: install,
    configurePreviewServer: install,
  };
}
