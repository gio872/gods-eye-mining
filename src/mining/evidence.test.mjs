import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMiningEvidenceBridge } from './evidence.js';

test('GEM combines terrain, hydrology, geology, imagery and layer context', async () => {
  const terrain = {
    async resolveEllipsoidalGround(points) {
      return points.map((point, index) => ({
        ellipsoid: 100 + index * 50,
        source: 'reearth',
      }));
    },
  };
  const featureSource = {
    async getFootprints() {
      return [
        {
          tags: { natural: 'water' },
          center: { lat: 4.45, lon: -75.2 },
        },
      ];
    },
  };
  const geologySource = {
    async getEvidence() {
      return [{ properties: { prospectivity: 0.8 } }];
    },
  };
  const imagerySource = async () => ({
    candidates: [{ cloud: 10 }, { cloud: 20 }],
    errors: [],
  });
  const imageryLayer = {
    getStats: () => ({ count: 2 }),
    getParams: () => ({ a: 'S30:2026-09-01' }),
  };
  const contextLayer = {
    id: 'local-dams',
    getAnalystRecords: () => [{ id: 'dam-1', lat: 4.45, lon: -75.2 }],
  };

  const bridge = createMiningEvidenceBridge({
    terrain,
    featureSource,
    geologySource,
    imageryLayer,
    imagerySource,
    getContextLayers: () => [contextLayer],
  });
  const rows = await bridge.buildEvidence([
    { id: 'a', lat: 4.45, lon: -75.2 },
    { id: 'b', lat: 4.46, lon: -75.21 },
    { id: 'c', lat: 4.47, lon: -75.22 },
  ]);

  assert.equal(rows.length, 3);
  assert.ok(rows[0].factors.terrain > 0);
  assert.equal(rows[0].factors.hydrology, 1);
  assert.equal(rows[0].factors.geology, 0.8);
  assert.equal(rows[0].factors['remote-sensing'], 0);
  assert.equal(rows[0].metadata.godEyeLayerContext['local-dams'], 1);
  assert.equal(rows[0].metadata.evidenceCoverage, 4 / 6);
});

test('GEM keeps unavailable geology and hydrology explicit', async () => {
  const bridge = createMiningEvidenceBridge({
    terrain: {
      async resolveEllipsoidalGround() {
        return [{ ellipsoid: 100, source: 'reearth' }];
      },
    },
    imagerySource: async () => ({ candidates: [], errors: [] }),
  });
  const rows = await bridge.buildEvidence([{ lat: 4.45, lon: -75.2 }]);
  assert.equal(rows[0].factors.geology, 0);
  assert.equal(rows[0].factors.hydrology, 0);
  assert.equal(rows[0].metadata.geologyAvailable, false);
  assert.equal(rows[0].metadata.evidenceCoverage, 1 / 6);
});
