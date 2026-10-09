import { openGemResourceDatabase, getResourceDatabaseSnapshot } from '../server/gem/gemResourceDatabase.js';
import { ingestGlobalResourceSources } from '../server/gem/globalResourceIngestion.js';

function number(name, fallback) {
  const value = process.env[name];
  const parsed = value == null ? NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const bbox = {
  west: number('GEM_INGEST_WEST', -180),
  south: number('GEM_INGEST_SOUTH', -85),
  east: number('GEM_INGEST_EAST', 180),
  north: number('GEM_INGEST_NORTH', 85),
};

const db = openGemResourceDatabase();
try {
  const result = await ingestGlobalResourceSources(db, {
    bbox,
    maxPages: Math.max(1, Math.min(10, number('GEM_INGEST_MAX_PAGES', 1))),
    stacLimit: Math.max(1, Math.min(100, number('GEM_INGEST_STAC_LIMIT', 20))),
    emitLimit: Math.max(1, Math.min(200, number('GEM_INGEST_EMIT_LIMIT', 20))),
    includeOneGeology: process.env.GEM_INGEST_ONEGEOLOGY !== 'false',
  });

  console.log(JSON.stringify({
    ok: true,
    result,
    database: getResourceDatabaseSnapshot(db),
  }, null, 2));
} finally {
  db.close();
}
