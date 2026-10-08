import test from 'node:test';
import assert from 'node:assert/strict';

import {
  contradictionPenalty,
  evidenceConfidence,
  mineralSystemScore,
  runMineralDiscoveryEngine,
  spatialCoherence,
} from './mineralDiscoveryEngine.js';

test('mineral system score rewards coherent independent evidence', () => {
  const result = mineralSystemScore({
    source: 90,
    pathway: 88,
    trap: 86,
    preservation: 82,
    geochemistry: 91,
    spectral: 89,
    geophysics: 87,
  });

  assert.ok(result.score > 85);
  assert.equal(result.coverage, 100);
});

test('missing evidence is not converted to zero', () => {
  const result = runMineralDiscoveryEngine({
    channels: { geology: 80, geochemistry: 70 },
  });

  assert.ok(result.score > 0);
  assert.equal(result.evidence.channelCoverage, 2);
  assert.ok(result.confidence < 100);
});

test('contradictions reduce ranking but remain distinct from missing data', () => {
  const clean = runMineralDiscoveryEngine({
    channels: { geology: 80, geochemistry: 80, geophysics: 80 },
  });
  const contradicted = runMineralDiscoveryEngine({
    channels: { geology: 80, geochemistry: 80, geophysics: 80 },
    contradictions: [70, 60],
  });

  assert.ok(contradicted.score < clean.score);
  assert.ok(contradictionPenalty([70, 60]) > 0);
});

test('spatial coherence is bounded', () => {
  const score = spatialCoherence([80, 82, 78, 81]);
  assert.ok(score >= 0 && score <= 100);
});

test('confidence depends on observed independent channels', () => {
  const one = evidenceConfidence({ channels: { geology: 80 } });
  const many = evidenceConfidence({
    channels: {
      geology: 80,
      geophysics: 82,
      geochemistry: 84,
      spectral: 86,
      structure: 78,
      reference: 90,
    },
  });

  assert.ok(many > one);
});
