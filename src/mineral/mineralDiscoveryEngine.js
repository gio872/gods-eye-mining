/**
 * GEM Mineral Discovery Engine
 *
 * Public-safe, deterministic core for multimodal mineral prospectivity.
 * It separates geological-system compatibility, evidence strength,
 * spatial coherence, contradictions, and uncertainty.
 */

export const MINERAL_DISCOVERY_ENGINE_ID = 'GEM-MINERAL-DISCOVERY-ENGINE';
export const MINERAL_DISCOVERY_ENGINE_VERSION = '1.0.0';

const DEFAULT_WEIGHTS = Object.freeze({
  geology: 0.22,
  geophysics: 0.18,
  geochemistry: 0.22,
  spectral: 0.18,
  structure: 0.10,
  reference: 0.10,
});

const clamp = (value, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number(value) || 0));

const finite = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

function normalizeEvidence(value) {
  const n = finite(value);
  return n == null ? null : clamp(n);
}

function robustMean(values) {
  const clean = values.filter((v) => v != null && Number.isFinite(v));
  if (!clean.length) return null;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function weightedMean(channels, weights) {
  let numerator = 0;
  let denominator = 0;
  for (const [channel, weight] of Object.entries(weights)) {
    const value = normalizeEvidence(channels[channel]);
    if (value == null) continue;
    numerator += value * weight;
    denominator += weight;
  }
  return denominator ? numerator / denominator : null;
}

/**
 * Scores whether evidence supports a coherent mineral-system hypothesis.
 */
export function mineralSystemScore(components = {}) {
  const groups = {
    source: robustMean([components.source, components.metalSource]),
    pathway: robustMean([components.pathway, components.structure]),
    trap: robustMean([components.trap, components.hostRock]),
    preservation: robustMean([components.preservation]),
    signature: robustMean([
      components.geochemistry,
      components.spectral,
      components.geophysics,
    ]),
  };

  const available = Object.values(groups).filter((v) => v != null);
  if (!available.length) return { score: null, coverage: 0, components: groups };

  const mean = available.reduce((s, v) => s + v, 0) / available.length;
  const minimum = Math.min(...available);
  const coherence = 100 - Math.abs(mean - minimum);

  const score = clamp(mean * 0.72 + coherence * 0.28);
  return {
    score: Math.round(score * 10) / 10,
    coverage: Math.round((available.length / 5) * 100),
    components: groups,
  };
}

/**
 * Rewards spatial agreement between independent evidence channels.
 */
export function spatialCoherence(neighbourhood = []) {
  const values = neighbourhood
    .map(finite)
    .filter((v) => v != null)
    .map(clamp);

  if (values.length < 2) return null;

  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const dispersion = Math.sqrt(variance);

  return Math.round(clamp(mean * 0.75 + (100 - dispersion) * 0.25) * 10) / 10;
}

/**
 * Penalizes explicit contradictory evidence without turning missing data into
 * negative evidence.
 */
export function contradictionPenalty(contradictions = []) {
  const values = contradictions
    .map(finite)
    .filter((v) => v != null)
    .map(clamp);

  if (!values.length) return 0;
  return Math.round(
    clamp(values.reduce((s, v) => s + v, 0) / values.length) * 10,
  ) / 10;
}

/**
 * Confidence is evidence quality, not discovery probability.
 */
export function evidenceConfidence({
  channels = {},
  contradictions = [],
  uncertainty = 0,
} = {}) {
  const present = Object.values(channels).filter(
    (v) => normalizeEvidence(v) != null,
  ).length;
  const channelCoverage = Math.min(
    1,
    present / Object.keys(DEFAULT_WEIGHTS).length,
  );
  const contradiction = contradictionPenalty(contradictions) / 100;
  const uncertaintyNorm = clamp(uncertainty) / 100;

  const confidence =
    100 *
    (0.58 * channelCoverage +
      0.42 *
        (1 -
          Math.min(1, 0.65 * contradiction + 0.35 * uncertaintyNorm)));

  return Math.round(clamp(confidence) * 10) / 10;
}

/**
 * Main GEM mining algorithm.
 *
 * Input channels are normalized 0..100. The engine does not invent absent
 * measurements and does not interpret the result as a probability.
 */
export function runMineralDiscoveryEngine(input = {}) {
  const channels = { ...input.channels };
  const weights = { ...DEFAULT_WEIGHTS, ...(input.weights || {}) };

  const base = weightedMean(channels, weights);
  const system = mineralSystemScore({
    ...(input.system || {}),
    geochemistry: channels.geochemistry,
    spectral: channels.spectral,
    geophysics: channels.geophysics,
    structure: channels.structure,
  });

  const coherence = spatialCoherence(input.neighbourhood || []);
  const contradiction = contradictionPenalty(input.contradictions || []);
  const uncertainty = clamp(input.uncertainty ?? 0);

  const systemScore = system.score ?? base ?? 0;
  const coherenceScore = coherence ?? 50;

  let score =
    (base ?? systemScore) * 0.54 +
    systemScore * 0.28 +
    coherenceScore * 0.18;

  score -= contradiction * 0.18;
  score -= uncertainty * 0.08;
  score = clamp(score);

  const confidence = evidenceConfidence({
    channels,
    contradictions: input.contradictions || [],
    uncertainty,
  });

  const observedChannels = Object.entries(channels)
    .filter(([, value]) => normalizeEvidence(value) != null)
    .map(([name]) => name);

  const ranking =
    score >= 80
      ? 'VERY_HIGH'
      : score >= 65
        ? 'HIGH'
        : score >= 50
          ? 'MODERATE'
          : score >= 35
            ? 'LOW'
            : 'VERY_LOW';

  return {
    engine: {
      id: MINERAL_DISCOVERY_ENGINE_ID,
      version: MINERAL_DISCOVERY_ENGINE_VERSION,
    },
    score: Math.round(score * 10) / 10,
    confidence,
    ranking,
    evidence: {
      observedChannels,
      channelCoverage: observedChannels.length,
      totalChannels: Object.keys(channels).length,
      mineralSystem: system,
      spatialCoherence: coherence,
      contradictionPenalty: contradiction,
      uncertainty,
    },
    interpretation:
      'Multimodal mineral prospectivity ranking. This is model inference, not a calibrated probability, mineral resource, reserve, grade or economic valuation.',
  };
}

export function toMiningTarget(result, context = {}) {
  if (!result || result.score == null) return null;

  return {
    ...context,
    mineralDiscoveryScore: result.score,
    mineralDiscoveryConfidence: result.confidence,
    mineralDiscoveryRank: result.ranking,
    engineId: result.engine.id,
    engineVersion: result.engine.version,
    evidenceCoverage: result.evidence.channelCoverage,
    evidenceObserved: result.evidence.observedChannels,
  };
}
