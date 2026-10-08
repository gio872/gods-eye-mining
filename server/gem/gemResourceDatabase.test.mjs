import test from 'node:test';
import assert from 'node:assert/strict';
import {
  openGemResourceDatabase,
  beginResourceIngestion,
  ingestSubsurfaceResources,
  queryResourceDatabase,
  getResourceDatabaseSnapshot,
  closeGemResourceDatabase,
} from './gemResourceDatabase.js';

test('GEM resource database creates schema and ingests depth-resolved records', () => {
  const db = openGemResourceDatabase(':memory:');
  try {
    const records = [
      {
        id: 'DB-AU-001',
        family: 'METAL',
        commodity: 'Au',
        latitude: 4.44,
        longitude: -75.23,
        topDepth: 120,
        bottomDepth: 155,
        depthDatum: 'GROUND',
        evidenceClass: 'DRILLED',
        confidence: 96,
        drillholeId: 'BH-001',
        source: { id: 'TEST-SOURCE', name: 'Test Geological Survey', version: '1' },
      },
      {
        id: 'DB-OIL-001',
        family: 'PETROLEUM',
        commodity: 'oil',
        latitude: 10,
        longitude: -70,
        depth: 2450,
        depthDatum: 'MSL',
        evidenceClass: 'OBSERVED',
        confidence: 88,
        wellId: 'W-001',
        source: { id: 'TEST-SOURCE', name: 'Test Geological Survey', version: '1' },
      },
    ];

    const batchId = beginResourceIngestion(db, {
      batchId: 'batch-test-001',
      source: { id: 'TEST-SOURCE', name: 'Test Geological Survey', version: '1' },
    });

    const result = ingestSubsurfaceResources(db, records, {
      batchId,
      source: { id: 'TEST-SOURCE', name: 'Test Geological Survey', version: '1' },
    });

    assert.equal(result.accepted, 2);
    assert.equal(result.rejected, 0);

    const hits = queryResourceDatabase(db, {
      west: -75.5,
      south: 4.2,
      east: -75.0,
      north: 4.7,
      commodity: 'gold',
      minDepth: 100,
      maxDepth: 200,
    });

    assert.equal(hits.length, 1);
    assert.equal(hits[0].resource_id, 'DB-AU-001');
    assert.equal(hits[0].depth_midpoint_m, 137.5);

    const snapshot = getResourceDatabaseSnapshot(db);
    assert.equal(snapshot.resources, 2);
    assert.equal(snapshot.depthResolved, 2);
    assert.equal(snapshot.drilled, 1);
    assert.equal(snapshot.sources, 1);
  } finally {
    closeGemResourceDatabase(db);
  }
});
