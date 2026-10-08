/**
 * GEM Multimodal Evidence Fusion.
 *
 * Scores are normalized to 0..100 and fused only across evidence channels
 * that are actually available for a target. Missing channels do not become
 * zeros; their weights are excluded from the denominator. The returned
 * coverage value tells the caller how much of the configured evidence model
 * is actually backed by data.
 */

export const EVIDENCE_CHANNELS = Object.freeze({
  reference: 0.35,
  geology: 0.12,
  geophysics: 0.13,
  geochemistry: 0.1,
  spectral: 0.1,
  structure: 0.07,
  terrain: 0.04,
  hydrology: 0.03,
  environment: 0.03,
  access: 0.03,
});

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function numericScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return clamp(number <= 1 ? number * 100 : number);
}

function normalizedWeights(weights) {
  const merged = weights == null ? EVIDENCE_CHANNELS : weights;
  const clean = {};
  let total = 0;
  for (const [channel, weight] of Object.entries(merged)) {
    const value = Number(weight);
    if (!Number.isFinite(value) || value <= 0) continue;
    clean[channel] = value;
    total += value;
  }
  if (!total)
    throw new RangeError('At least one positive evidence weight is required');
  return Object.fromEntries(
    Object.entries(clean).map(([channel, weight]) => [channel, weight / total]),
  );
}

export function fuseEvidence(
  referenceScore,
  channels = {},
  { weights = EVIDENCE_CHANNELS } = {},
) {
  const normalized = normalizedWeights(weights);
  const available = [];

  const reference = numericScore(referenceScore);
  if (reference != null && normalized.reference != null)
    available.push(['reference', reference, normalized.reference]);

  for (const [channel, value] of Object.entries(channels || {})) {
    const score = numericScore(value);
    const weight = normalized[channel];
    if (score == null || weight == null) continue;
    available.push([channel, score, weight]);
  }

  const totalAvailableWeight = available.reduce(
    (sum, entry) => sum + entry[2],
    0,
  );

  if (!totalAvailableWeight)
    return {
      score: 0,
      coverage: 0,
      confidence: 0,
      mode: 'NO_EVIDENCE',
      contributions: {},
      availableChannels: [],
    };

  const score =
    available.reduce((sum, entry) => sum + entry[1] * entry[2], 0) /
    totalAvailableWeight;

  const contributions = Object.fromEntries(
    available.map(([channel, value, weight]) => [
      channel,
      Math.round(((value * weight) / totalAvailableWeight) * 10) / 10,
    ]),
  );

  const availableChannels = available.map(([channel]) => channel);
  const coverage = totalAvailableWeight;
  const mode =
    availableChannels.length > 1
      ? 'MULTIMODAL_FUSION'
      : availableChannels[0] === 'reference'
        ? 'REFERENCE_ONLY'
        : 'SINGLE_CHANNEL';

  return {
    score: Math.round(clamp(score) * 10) / 10,
    coverage: Math.round(clamp(coverage, 0, 1) * 1000) / 10,
    confidence:
      Math.round(
        clamp(
          Math.min(
            1,
            coverage *
              (0.65 + 0.35 * Math.min(1, availableChannels.length / 4)),
          ),
          0,
          1,
        ) * 1000,
      ) / 10,
    mode,
    contributions,
    availableChannels,
  };
}
