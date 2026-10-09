import test from 'node:test';
import assert from 'node:assert/strict';
import {
  openGemResourceDatabase,
  getResourceDatabaseSnapshot,
  closeGemResourceDatabase,
} from './gemResourceDatabase.js';
import { ingestGlobalResourceSources } from './globalResourceIngestion.js';

function response(payload, status = 200, contentType = 'application/json') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    headers: { get: () => contentType },
    async json() { return payload; },
    async text() { return typeof payload === 'string' ? payload : JSON.stringify(payload); },
  };
}

test('global ingestion orchestrator connects mineral, geochem, STAC, EMIT and OneGeology adapters', async () => {
  const db = openGemResourceDatabase(':memory:');
  const fetchImpl = async (url) => {
    const value = String(url);
    if (value.includes('MRData') || value.includes('Mineral_Resource_Data_System')) {
      return response({
        features: [{
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-75.23, 4.44] },
          properties: { gid: '1', site_name: 'Test Gold', mineral: 'gold', dev_stat: 'occurrence' },
        }],
      });
    }
    if (value.includes('Global_distribution_of_selected_critical_minerals')) {
      return response({ features: [] });
    }
    if (value.includes('services.ga.gov.au')) {
      return response({
        features: [{
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-75.20, 4.40] },
          properties: { sample_id: 'GC-1', au: 3.2, cu: 120, as: 20 },
        }],
      });
    }
    if (value.includes('earth-search.aws.element84.com')) {
      return response({
        features: [{
          id: 'S2-TEST',
          geometry: { type: 'Polygon', coordinates: [] },
          bbox: [-76, 4, -75, 5],
          properties: { datetime: '2026-01-01T00:00:00Z' },
          assets: { B04: { href: 'https://example.test/b04.tif' } },
        }],
      });
    }
    if (value.includes('geoservice.dlr.de')) {
      return response({ features: [] });
    }
    if (value.includes('cmr.earthdata.nasa.gov')) {
      return response({ feed: { entry: [{ id: 'EMIT-TEST', timeStart: '2026-01-01T00:00:00Z' }] } });
    }
    if (value.includes('onegeology.org')) {
      return response('<html><a href="https://example.test/wfs?service=WFS">WFS</a></html>', 200, 'text/html');
    }
    throw new Error('Unexpected URL: ' + value);
  };

  try {
    const result = await ingestGlobalResourceSources(db, {
      bbox: { west: -76, south: 4, east: -75, north: 5 },
      fetchImpl,
      includeOneGeology: true,
      stacLimit: 2,
      emitLimit: 2,
    });

    const snapshot = getResourceDatabaseSnapshot(db);
    assert.equal(result.summary.mineralRecordsAccepted, 1);
    assert.ok(snapshot.resources >= 1);
    assert.ok(snapshot.geochemicalSamples >= 1);
    assert.ok(snapshot.planetaryObservations >= 2);
    assert.ok(snapshot.geologyServices >= 1);
    assert.equal(result.sources['usgs-mrds'].ok, true);
    assert.equal(result.sources['cmio-geochemistry-global'].ok, true);
    assert.equal(result.sources['emit-l2bmin-earthdata'].ok, true);
  } finally {
    closeGemResourceDatabase(db);
  }
});
