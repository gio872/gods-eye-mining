import {
  openGemResourceDatabase,
  ingestSubsurfaceResources,
  queryResourceDatabase,
  getResourceDatabaseSnapshot,
} from './gemResourceDatabase.js';

const MAX_BODY_BYTES = Number(process.env.GEM_RESOURCE_MAX_BODY_BYTES || 25 * 1024 * 1024);
const INGEST_KEY = process.env.GEM_RESOURCE_INGEST_KEY || '';

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(body);
}

function authorized(req) {
  if (!INGEST_KEY) return false;
  const header = req.headers['x-gem-ingest-key'];
  return typeof header === 'string' && header === INGEST_KEY;
}

async function readBody(req) {
  let total = 0;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw new Error('Payload exceeds GEM_RESOURCE_MAX_BODY_BYTES');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parsePayload(raw, contentType = '') {
  if (contentType.includes('application/x-ndjson')) {
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }
  const payload = JSON.parse(raw || '{}');
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.records)) return payload.records;
  throw new Error('Expected an array or { records: [] }');
}

function queryFromUrl(url) {
  const p = new URL(url, 'http://gem.local').searchParams;
  const number = (name, fallback = null) => {
    const value = p.get(name);
    if (value == null || value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  return {
    west: number('west', -180),
    south: number('south', -90),
    east: number('east', 180),
    north: number('north', 90),
    commodity: p.get('commodity') || null,
    family: p.get('family') || null,
    minDepth: number('minDepth'),
    maxDepth: number('maxDepth'),
    evidenceClass: p.get('evidenceClass') || null,
    minConfidence: number('minConfidence', 0),
    limit: number('limit', 500),
  };
}

/**
 * Node HTTP handler ready to mount at /api/gem/resources.
 *
 * GET  /api/gem/resources          spatial/depth query
 * GET  /api/gem/resources/snapshot database statistics
 * POST /api/gem/resources/ingest   JSON array or NDJSON bulk ingestion
 *
 * POST requires X-GEM-Ingest-Key and GEM_RESOURCE_INGEST_KEY on the server.
 */
export function createGemResourceApiHandler({ db = null } = {}) {
  const database = db || openGemResourceDatabase();

  return async function gemResourceApiHandler(req, res) {
    try {
      const url = new URL(req.url || '/', 'http://gem.local');
      const pathname = url.pathname.replace(/\/$/, '');

      if (req.method === 'GET' && pathname.endsWith('/snapshot')) {
        return send(res, 200, getResourceDatabaseSnapshot(database));
      }

      if (req.method === 'GET' && pathname.endsWith('/resources')) {
        const rows = queryResourceDatabase(database, queryFromUrl(req.url || '/'));
        return send(res, 200, {
          version: '1.0.0',
          count: rows.length,
          records: rows,
        });
      }

      if (req.method === 'POST' && pathname.endsWith('/ingest')) {
        if (!authorized(req)) return send(res, 401, { error: 'GEM resource ingestion is not authorized' });

        const records = parsePayload(
          await readBody(req),
          String(req.headers['content-type'] || ''),
        );

        const sourceId = String(req.headers['x-gem-source-id'] || '').trim();
        const sourceName = String(req.headers['x-gem-source-name'] || '').trim();

        const result = ingestSubsurfaceResources(database, records, {
          source: sourceId
            ? {
                id: sourceId,
                name: sourceName || sourceId,
                version: String(req.headers['x-gem-source-version'] || ''),
              }
            : null,
          metadata: {
            transport: 'GEM_RESOURCE_API',
            contentType: req.headers['content-type'] || '',
          },
        });

        return send(res, result.rejected ? 207 : 201, result);
      }

      return send(res, 404, { error: 'GEM resource endpoint not found' });
    } catch (error) {
      const message = String(error?.message || error);
      const status = /payload|JSON|Expected|exceeds/i.test(message) ? 400 : 500;
      return send(res, status, { error: message });
    }
  };
}
