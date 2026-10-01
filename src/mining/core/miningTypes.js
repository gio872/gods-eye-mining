/** Shared GEM domain primitives. Keep core calculations free of Cesium and UI dependencies. */

export const MINING_COMMODITIES = Object.freeze([
  'gold',
  'copper',
  'silver',
  'tungsten',
  'rare-earth-elements',
  'pgm',
  'coltan',
  'manganese',
]);

export const PROSPECTIVITY_FACTORS = Object.freeze([
  'terrain',
  'hydrology',
  'geology',
  'remote-sensing',
  'sampling',
]);

export function clamp(value, min = 0, max = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

export function normalizeFactorMap(input = {}) {
  const output = {};
  for (const factor of PROSPECTIVITY_FACTORS) {
    output[factor] = clamp(input?.[factor]);
  }
  return Object.freeze(output);
}

export function normalizeCoordinate(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function createMiningTarget({
  id,
  latitude,
  longitude,
  commodity = 'gold',
  score = 0,
  factors = {},
  source = 'gem',
  confidence = 0,
  metadata = {},
} = {}) {
  if (typeof id !== 'string' || !id.trim()) {
    throw new TypeError('A mining target id is required');
  }

  return Object.freeze({
    id: id.trim(),
    latitude: normalizeCoordinate(latitude),
    longitude: normalizeCoordinate(longitude),
    commodity,
    score: clamp(score),
    confidence: clamp(confidence),
    factors: normalizeFactorMap(factors),
    source,
    metadata: Object.freeze({ ...metadata }),
  });
}
