import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProjectEconomicsLayer,
  createCriticalMineralsLayer,
  createEntityIntelligenceLayer,
  createTradeIntelligenceLayer,
} from './layers.js';

test('intelligence layers expose stable lifecycle identities and diagnostics', () => {
  const layers = [
    createProjectEconomicsLayer(),
    createCriticalMineralsLayer(),
    createEntityIntelligenceLayer(),
    createTradeIntelligenceLayer(),
  ];

  assert.deepEqual(
    layers.map((layer) => layer.id),
    [
      'mining-economics',
      'critical-minerals',
      'entity-intelligence',
      'mineral-trade-intelligence',
    ],
  );

  for (const layer of layers) {
    assert.equal(typeof layer.init, 'function');
    assert.equal(typeof layer.enable, 'function');
    assert.equal(typeof layer.disable, 'function');
    assert.equal(typeof layer.destroy, 'function');
    assert.equal(layer.getStats().enabled, false);
  }

  assert.equal(layers[1].getStats().count, 60);
  assert.equal(layers[2].getStats().status, 'NOT_SCREENED');
  assert.equal(layers[3].getStats().corridors, 3);
});
