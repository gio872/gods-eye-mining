import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateGrossMetalValue,
  normalizeRecoveryPercent,
} from './economicValue.js';

test('gold scenario converts g/t to recovered troy ounces and gross USD', () => {
  const result = calculateGrossMetalValue({
    commodity: 'gold',
    tonnes: 1000,
    grade: 1,
    recoveryPercent: 90,
    priceUsd: 2000,
  });

  assert.equal(result.gradeUnit, 'g/t');
  assert.equal(result.priceUnit, 'USD/toz');
  assert.equal(result.recoveredMetalGrams, 900);
  assert.ok(Math.abs(result.recoveredTroyOz - 28.9359) < 0.001);
  assert.ok(Math.abs(result.grossValueUsd - 57871.8) < 2);
});

test('base-metal scenario uses percentage grade and USD per metric tonne', () => {
  const result = calculateGrossMetalValue({
    commodity: 'copper',
    tonnes: 1000,
    grade: 2,
    recoveryPercent: 80,
    priceUsd: 10000,
  });

  assert.equal(result.gradeUnit, '%');
  assert.equal(result.priceUnit, 'USD/mt');
  assert.equal(result.containedMetalTonnes, 20);
  assert.equal(result.recoveredMetalTonnes, 16);
  assert.equal(result.grossValueUsd, 160000);
});

test('invalid recovery is constrained to the physical range', () => {
  assert.equal(normalizeRecoveryPercent(-10), 0);
  assert.equal(normalizeRecoveryPercent(150), 100);
});
