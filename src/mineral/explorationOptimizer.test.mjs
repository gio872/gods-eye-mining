import test from 'node:test';
import assert from 'node:assert/strict';

import {
  actionValue,
  buildExplorationPlan,
  rankExplorationActions,
} from './explorationOptimizer.js';

test('missing channels receive exploration priority', () => {
  const actions = rankExplorationActions({
    channels: { geology: 85, geochemistry: 82 },
    targetScore: 78,
    confidence: 45,
  });

  assert.ok(actions.length > 0);
  assert.ok(actions.every((action) => !['geology', 'geochemistry'].includes(action.channel)));
});

test('action value is finite and bounded', () => {
  const value = actionValue(
    { channel: 'spectral', cost: 20, speed: 80, independence: 0.8 },
    { channels: {}, targetScore: 70, confidence: 30 },
  );

  assert.ok(Number.isFinite(value));
  assert.ok(value >= 0 && value <= 100);
});

test('high-confidence targets move toward validation', () => {
  const plan = buildExplorationPlan({
    channels: {
      geology: 90,
      geophysics: 86,
      geochemistry: 88,
      spectral: 84,
      structure: 82,
    },
    targetScore: 82,
    confidence: 80,
  });

  assert.equal(plan.decisionState, 'ADVANCE_TO_VALIDATION');
});

test('low-potential targets remain reconnaissance', () => {
  const plan = buildExplorationPlan({
    channels: { geology: 30 },
    targetScore: 32,
    confidence: 25,
  });

  assert.equal(plan.decisionState, 'RECONNAISSANCE');
});
