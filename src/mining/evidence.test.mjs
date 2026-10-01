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
  assert.equal(rows[0].metadata.evidenceCoverage, 4 / 10);
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
  assert.equal(rows[0].metadata.evidenceCoverage, 1 / 10);
});


test('GEM places SGC geochemistry, lineaments and drainage plus real spectral anomalies into one score input', async () => {
  const bridge = createMiningEvidenceBridge({
    terrain: {
      async resolveEllipsoidalGround(points) {
        return points.map((point) => ({
          ellipsoid: 100,
          source: 'terrain-test',
        }));
      },
    },
    featureSource: {
      async getFootprints() {
        return [];
      },
    },
    geologySource: {
      async getEvidence({ points }) {
        return {
          values: points.map(() => 0.5),
          geologyValues: points.map(() => 0.5),
          structureValues: points.map(() => 0.7),
          mineralizationValues: points.map(() => 0.6),
          alluvialValues: points.map(() => 0.4),
          lineamentValues: points.map(() => 0.8),
          drainageValues: points.map(() => 0.9),
          geochemistryValues: points.map(() => 0.75),
          auAnomalyValues: points.map(() => 0.8),
          agAnomalyValues: points.map(() => 0.6),
          cuAnomalyValues: points.map(() => 0.5),
          rawGeochemistry: {
            au: points.map(() => 100),
            ag: points.map(() => 10),
            cu: points.map(() => 20),
          },
          source: 'SGC exploration',
          geologyMapFeatureCount: 1,
          faultFeatureCount: 1,
          lineamentFeatureCount: 1,
          featureCount: 1,
          alluvialFeatureCount: 1,
          drainageSimpleFeatureCount: 1,
          geochemistrySampleCount: points.length,
          geochemistrySource: 'SGC Atlas Geoquímico 2020 · Au/Ag/Cu',
        };
      },
    },
    imagerySource: async () => ({ candidates: [{ cloud: 10 }], errors: [] }),
    remoteSensingSource: async ({ points }) => ({
      values: points.map((point, index) => index / Math.max(1, points.length - 1)),
      source: 'HLS spectral test',
      indices: points.map(() => ({
        ferric: 1.4,
        ferrous: 0.6,
        clay: 1.2,
        ndvi: 0.2,
      })),
      itemId: 'spectral-test',
      itemDatetime: '2026-09-20T12:00:00Z',
      cloudCover: 10,
      method: 'test',
    }),
  });

  const rows = await bridge.buildEvidence(
    [
      { id: 'a', lat: 4.45, lon: -75.20 },
      { id: 'b', lat: 4.451, lon: -75.201 },
      { id: 'c', lat: 4.452, lon: -75.202 },
    ],
    { commodity: 'gold', profile: 'gold-alluvial' },
  );

  assert.equal(rows[0].metadata.evidenceCoverage, 1);
  assert.equal(rows[0].metadata.auAnomaly, 0.8);
  assert.equal(rows[0].metadata.agAnomaly, 0.6);
  assert.equal(rows[0].metadata.cuAnomaly, 0.5);
  assert.equal(rows[0].factors.geochemistry, 0.75);
  assert.equal(rows[0].factors.lineaments, 0.8);
  assert.equal(rows[0].factors.drainage, 0.9);
  assert.equal(rows[0].factors['remote-sensing'], 0);
  assert.ok(rows[2].factors['remote-sensing'] > 0);
  assert.deepEqual(rows[0].metadata.spectralScene.itemId, 'spectral-test');
  assert.ok(rows[0].metadata.factorsCovered.length >= 10);
});
