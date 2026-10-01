import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProjectEconomicsLayer,
  createCriticalMineralsLayer,
  createEntityIntelligenceLayer,
  createTradeIntelligenceLayer,
} from './layers.js';
import {
  getCriticalMineralRecord,
  getTaxonomyStats,
  calculateCriticalityDimensions,
  calculateCriticalityCoverage,
  buildSupplyChainProfile,
  buildSupplyShockScenario,
} from './criticalMinerals/index.js';

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

test('global critical minerals registry is versioned and multi-taxonomy', () => {
  const stats=getTaxonomyStats();
  assert.equal(stats.usgs2025,60);
  assert.equal(stats.euCrma2024,34);
  assert.equal(stats.euStrategic2024,17);
  assert.ok(stats.iea2026 >= 30);
  const tungsten=getCriticalMineralRecord('tungsten');
  assert.equal(tungsten.classifications.usgs,'USGS_2025');
  assert.equal(tungsten.classifications.eu,'EU_CRM');
  assert.equal(tungsten.classifications.euStrategic,'EU_SRM');
  assert.equal(tungsten.temporal.dynamicMetrics,'NOT_CONNECTED');
});

test('criticality analytics are transparent and never fabricate missing metrics', () => {
  const partial=calculateCriticalityDimensions({supplyRisk:80,refiningConcentration:90});
  assert.equal(partial.supplyRisk,80);
  assert.equal(partial.geopoliticalRisk,null);
  assert.equal(calculateCriticalityCoverage({supplyRisk:80}).status,'PARTIAL');
  assert.equal(calculateCriticalityCoverage().status,'DATA_REQUIRED');
  const chain=buildSupplyChainProfile({mining:{countries:['CO'],capacity:100,source:'test'}});
  assert.equal(chain.length,9);
  assert.deepEqual(chain[1].countries,['CO']);
  const shock=buildSupplyShockScenario({baselineSupply:100,disruptedSupply:60,demand:90,durationMonths:6});
  assert.equal(shock.shortfall,30);
  assert.equal(shock.shortfallPercent,33.33333333333333);
});
