const TROY_OZ_GRAMS = 31.1034768;

const PRECIOUS = new Set(['gold', 'silver', 'platinum', 'palladium']);

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeRecoveryPercent(value, fallback = 90) {
  const number = finite(value);
  if (number === null) return fallback;
  return Math.min(100, Math.max(0, number));
}

export function calculateGrossMetalValue({
  commodity = 'gold',
  tonnes = 0,
  grade = 0,
  recoveryPercent = 90,
  priceUsd = null,
} = {}) {
  const totalTonnes = Math.max(0, finite(tonnes) ?? 0);
  const numericGrade = Math.max(0, finite(grade) ?? 0);
  const recovery = normalizeRecoveryPercent(recoveryPercent) / 100;
  const price = finite(priceUsd);
  const precious = PRECIOUS.has(commodity);

  if (price === null || price < 0) {
    return Object.freeze({
      commodity,
      priceUnit: precious ? 'USD/toz' : 'USD/mt',
      gradeUnit: precious ? 'g/t' : '%',
      tonnes: totalTonnes,
      grade: numericGrade,
      recoveryPercent: recovery * 100,
      priceUsd: null,
      containedMetalTonnes: 0,
      containedMetalKg: 0,
      containedMetalGrams: 0,
      recoveredMetalTonnes: 0,
      recoveredMetalKg: 0,
      recoveredMetalGrams: 0,
      recoveredTroyOz: 0,
      grossValueUsd: null,
    });
  }

  if (precious) {
    const containedMetalGrams = totalTonnes * numericGrade;
    const recoveredMetalGrams = containedMetalGrams * recovery;
    const recoveredTroyOz = recoveredMetalGrams / TROY_OZ_GRAMS;
    return Object.freeze({
      commodity,
      priceUnit: 'USD/toz',
      gradeUnit: 'g/t',
      tonnes: totalTonnes,
      grade: numericGrade,
      recoveryPercent: recovery * 100,
      priceUsd: price,
      containedMetalTonnes: containedMetalGrams / 1_000_000,
      containedMetalKg: containedMetalGrams / 1000,
      containedMetalGrams,
      recoveredMetalTonnes: recoveredMetalGrams / 1_000_000,
      recoveredMetalKg: recoveredMetalGrams / 1000,
      recoveredMetalGrams,
      recoveredTroyOz,
      grossValueUsd: recoveredTroyOz * price,
    });
  }

  const containedMetalTonnes = totalTonnes * (numericGrade / 100);
  const recoveredMetalTonnes = containedMetalTonnes * recovery;
  return Object.freeze({
    commodity,
    priceUnit: 'USD/mt',
    gradeUnit: '%',
    tonnes: totalTonnes,
    grade: numericGrade,
    recoveryPercent: recovery * 100,
    priceUsd: price,
    containedMetalTonnes,
    containedMetalKg: recoveredMetalTonnes * 1000 / recovery,
    containedMetalGrams: containedMetalTonnes * 1_000_000,
    recoveredMetalTonnes,
    recoveredMetalKg: recoveredMetalTonnes * 1000,
    recoveredMetalGrams: recoveredMetalTonnes * 1_000_000,
    recoveredTroyOz: 0,
    grossValueUsd: recoveredMetalTonnes * price,
  });
}

export const ECONOMIC_VALUE_CONSTANTS = Object.freeze({
  troyOunceGrams: TROY_OZ_GRAMS,
  preciousGradeUnit: 'g/t',
  baseGradeUnit: '%',
  scope: 'gross-scenario-only',
});
