import {
  PROSPECTIVITY_FACTORS,
  clamp,
  createMiningTarget,
  normalizeFactorMap,
} from './miningTypes.js';

const DEFAULT_WEIGHTS = Object.freeze({
  terrain: 0.2,
  hydrology: 0.2,
  geology: 0.3,
  'remote-sensing': 0.2,
  sampling: 0.1,
});

function normalizeWeights(weights = DEFAULT_WEIGHTS) {
  const raw = PROSPECTIVITY_FACTORS.map((factor) =>
    Math.max(0, Number(weights?.[factor]) || 0),
  );
  const total = raw.reduce((sum, value) => sum + value, 0);
  if (total === 0) return DEFAULT_WEIGHTS;

  return Object.fromEntries(
    PROSPECTIVITY_FACTORS.map((factor, index) => [factor, raw[index] / total]),
  );
}

function weightedScore(factors, weights) {
  return clamp(
    PROSPECTIVITY_FACTORS.reduce(
      (sum, factor) => sum + factors[factor] * weights[factor],
      0,
    ),
  );
}

/**
 * Pure prospectivity scoring. Inputs are normalized 0..1 evidence signals.
 * This is an analytical heuristic, not a declaration of mineral reserves.
 */
export function createProspectivityEngine({ weights = DEFAULT_WEIGHTS } = {}) {
  const normalizedWeights = Object.freeze(normalizeWeights(weights));

  function score({ factors = {}, commodity = 'gold', id, latitude, longitude, source, confidence, metadata } = {}) {
    const normalizedFactors = normalizeFactorMap(factors);
    const scoreValue = weightedScore(normalizedFactors, normalizedWeights);

    return createMiningTarget({
      id: id ?? `gem-target-${Date.now()}`,
      latitude,
      longitude,
      commodity,
      score: scoreValue,
      confidence: confidence ?? scoreValue,
      factors: normalizedFactors,
      source,
      metadata,
    });
  }

  function rank(candidates = []) {
    return [...candidates]
      .map((candidate) => (candidate?.score === undefined ? score(candidate) : candidate))
      .sort((a, b) => b.score - a.score);
  }

  return Object.freeze({
    getWeights: () => normalizedWeights,
    score,
    rank,
  });
}
