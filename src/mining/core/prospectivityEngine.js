import {
  PROSPECTIVITY_FACTORS,
  PROSPECTIVITY_PROFILES,
  clamp,
  createMiningTarget,
  normalizeFactorMap,
} from './miningTypes.js';

function normalizeWeights(weights) {
  const raw = PROSPECTIVITY_FACTORS.map((factor) =>
    Math.max(0, Number(weights?.[factor]) || 0),
  );
  const total = raw.reduce((sum, value) => sum + value, 0);
  if (total === 0) return normalizeWeights(PROSPECTIVITY_PROFILES.base.weights);
  return Object.fromEntries(
    PROSPECTIVITY_FACTORS.map((factor, index) => [factor, raw[index] / total]),
  );
}

function scoreCoverage(confidence) {
  return clamp(confidence == null ? 1 : confidence);
}

/**
 * Pure prospectivity scoring. Every factor is normalized 0..1.
 * The coverage multiplier prevents a map with missing evidence channels from
 * presenting the same score as a fully observed cell.
 */
export function createProspectivityEngine({
  profile = 'base',
  weights,
  coverageFloor = 0,
} = {}) {
  const selectedProfile =
    PROSPECTIVITY_PROFILES[profile] || PROSPECTIVITY_PROFILES.base;
  const normalizedWeights = Object.freeze(
    normalizeWeights(weights || selectedProfile.weights),
  );
  const normalizedProfile = PROSPECTIVITY_PROFILES[profile] ? profile : 'base';

  function score({
    factors = {},
    commodity = selectedProfile.commodity,
    id,
    latitude,
    longitude,
    source,
    confidence,
    metadata,
  } = {}) {
    const normalizedFactors = normalizeFactorMap(factors);
    const evidenceCoverage = scoreCoverage(confidence);
    const rawScore = clamp(
      PROSPECTIVITY_FACTORS.reduce(
        (sum, factor) =>
          sum + normalizedFactors[factor] * normalizedWeights[factor],
        0,
      ),
    );
    const coverageMultiplier = Math.max(coverageFloor, evidenceCoverage);
    const scoreValue = clamp(rawScore * coverageMultiplier);

    return createMiningTarget({
      id: id ?? `gem-target-${Date.now()}`,
      latitude,
      longitude,
      commodity,
      profile: normalizedProfile,
      score: scoreValue,
      confidence: evidenceCoverage,
      factors: normalizedFactors,
      source,
      metadata,
    });
  }

  function rank(candidates = []) {
    return [...candidates]
      .map((candidate) =>
        candidate?.score === undefined ? score(candidate) : candidate,
      )
      .sort((a, b) => b.score - a.score);
  }

  return Object.freeze({
    getProfile: () => normalizedProfile,
    getWeights: () => normalizedWeights,
    score,
    rank,
  });
}
