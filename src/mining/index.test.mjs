import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MINING_COMMODITIES,
  PROSPECTIVITY_FACTORS,
  createMiningEngine,
  createMiningTarget,
  createProspectivityEngine,
} from './index.js';

test('GEM exposes stable mining domain primitives', () => {
  assert.equal(MINING_COMMODITIES.includes('gold'), true);
  assert.deepEqual(PROSPECTIVITY_FACTORS, [
    'terrain',
    'hydrology',
    'geology',
    'structure',
    'mineralization',
    'remote-sensing',
    'alluvial',
    'sampling',
  ]);
});

test('factor values are normalized to the analytical range', () => {
  const target = createMiningTarget({
    id: 'target-1',
    latitude: 4.45,
    longitude: -75.24,
    factors: {
      terrain: 2,
      hydrology: -1,
      geology: 0.5,
      'remote-sensing': Number.NaN,
      sampling: 0.75,
    },
  });

  assert.equal(target.factors.terrain, 1);
  assert.equal(target.factors.hydrology, 0);
  assert.equal(target.factors.geology, 0.5);
  assert.equal(target.factors['remote-sensing'], 0);
  assert.equal(target.factors.sampling, 0.75);
});

test('prospectivity scoring normalizes weights and ranks candidates', () => {
  const engine = createProspectivityEngine({
    weights: {
      terrain: 0,
      hydrology: 0,
      geology: 1,
      'remote-sensing': 0,
      sampling: 0,
    },
  });

  const high = engine.score({
    id: 'high',
    latitude: 4.4,
    longitude: -75.2,
    factors: { geology: 0.9 },
  });
  const low = engine.score({
    id: 'low',
    latitude: 4.4,
    longitude: -75.2,
    factors: { geology: 0.2 },
  });

  assert.equal(high.score, 0.9);
  assert.equal(low.score, 0.2);
  assert.deepEqual(engine.rank([low, high]).map((target) => target.id), [
    'high',
    'low',
  ]);
});

test('mining engine stores and removes analyzed targets', () => {
  const engine = createMiningEngine();

  engine.analyze([
    {
      id: 'a',
      latitude: 4.45,
      longitude: -75.2,
      factors: { geology: 0.9, hydrology: 0.8 },
    },
    {
      id: 'b',
      latitude: 4.46,
      longitude: -75.21,
      factors: { geology: 0.3, hydrology: 0.4 },
    },
  ]);

  assert.deepEqual(engine.getTargets().map((target) => target.id), ['a', 'b']);
  assert.equal(engine.removeTarget('a'), true);
  assert.equal(engine.getTarget('a'), undefined);
});

test('core remains deterministic for explicit target identifiers', () => {
  const engine = createMiningEngine({
    weights: {
      terrain: 1,
      hydrology: 0,
      geology: 0,
      'remote-sensing': 0,
      sampling: 0,
    },
  });

  const first = engine.upsert({
    id: 'deterministic',
    latitude: 4.45,
    longitude: -75.2,
    factors: { terrain: 0.67 },
  });
  const second = engine.upsert({
    id: 'deterministic',
    latitude: 4.45,
    longitude: -75.2,
    factors: { terrain: 0.67 },
  });

  assert.deepEqual(first, second);
});


test('gold-alluvial profile prioritizes alluvial and drainage evidence', () => {
  const engine = createProspectivityEngine({ profile: 'gold-alluvial' });
  const alluvial = engine.score({
    id: 'alluvial',
    latitude: 4.45,
    longitude: -75.2,
    confidence: 1,
    factors: {
      hydrology: 1,
      alluvial: 1,
      mineralization: 0.5,
    },
  });
  const hardRock = engine.score({
    id: 'hard-rock',
    latitude: 4.45,
    longitude: -75.2,
    confidence: 1,
    factors: {
      structure: 1,
      geology: 1,
    },
  });
  assert.ok(alluvial.score > hardRock.score);
  assert.equal(alluvial.profile, 'gold-alluvial');
});

test('coverage lowers score when channels are unavailable', () => {
  const engine = createProspectivityEngine({
    profile: 'base',
    weights: {
      geology: 1,
    },
  });
  const full = engine.score({
    id: 'full',
    latitude: 4.45,
    longitude: -75.2,
    confidence: 1,
    factors: { geology: 1 },
  });
  const partial = engine.score({
    id: 'partial',
    latitude: 4.45,
    longitude: -75.2,
    confidence: 0.25,
    factors: { geology: 1 },
  });
  assert.ok(partial.score < full.score);
});
