const TROY_OZ_GRAMS = 31.1034768;

const PRECIOUS = new Set(['gold', 'silver', 'platinum', 'palladium']);

export function normalizeRecoveryPercent(value, fallback = 90) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(100, Math.max(0, number));
}

export function calculateGrossMetalValue({
  commodity = 'gold',
  tonnes = 0,
  grade = 0,
  recoveryPercent = 90,
  priceUsd = null,
} = {}) {
  const totalTonnes = Math.max(0, Number(tonnes) || 0);
  const numericGrade = Math.max(0, Number(grade) || 0);
  const recovery = normalizeRecoveryPercent(recoveryPercent) / 100;
  const price = Number(priceUsd);

  if (!Number.isFinite(price) || price < 0) {
    return Object.freeze({
      commodity,
      tonnes: totalTonnes,
      grade: numericGrade,
      recoveryPercent: recovery * 100,
      priceUsd: null,
      containedMetalKg: 0,
      containedMetalGrams: 0,
      recoveredMetalGrams: 0,
      recoveredTroyOz: 0,
      grossValueUsd: null,
    });
  }

  let containedMetalGrams;
  if (PRECIOUS.has(commodity)) {
    // Precious-metal exploration grade convention: g/t.
    containedMetalGrams = totalTonnes * numericGrade;
  } else {
    // Base/industrial metals: grade convention is percent by mass.
    containedMetalGrams = totalTonnes * 1000 * (numericGrade / 100);
  }
  const recoveredMetalGrams = containedMetalGrams * recovery;
  const recoveredTroyOz = recoveredMetalGrams / TROY_OZ_GRAMS;
  const grossValueUsd = recoveredTroyOz * price;

  return Object.freeze({
    commodity,
    tonnes: totalTonnes,
    grade: numericGrade,
    recoveryPercent: recovery * 100,
    priceUsd: price,
    containedMetalKg: containedMetalGrams / 1000,
    containedMetalGrams,
    recoveredMetalGrams,
    recoveredTroyOz,
    grossValueUsd,
  });
}

export const ECONOMIC_VALUE_CONSTANTS = Object.freeze({
  troyOunceGrams: TROY_OZ_GRAMS,
  preciousGradeUnit: 'g/t',
  baseGradeUnit: '%',
  scope: 'gross-scenario-only',
});
