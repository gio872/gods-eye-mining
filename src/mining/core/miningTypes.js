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
  'structure',
  'mineralization',
  'remote-sensing',
  'alluvial',
  'sampling',
]);

export const PROSPECTIVITY_PROFILES = Object.freeze({
  'gold-lode': Object.freeze({
    label: 'Gold · hard-rock / lode',
    commodity: 'gold',
    weights: Object.freeze({
      terrain: 0.08,
      hydrology: 0.04,
      geology: 0.18,
      structure: 0.18,
      mineralization: 0.24,
      'remote-sensing': 0,
      alluvial: 0.05,
      sampling: 0,
    }),
  }),
  'gold-alluvial': Object.freeze({
    label: 'Gold · alluvial',
    commodity: 'gold',
    weights: Object.freeze({
      terrain: 0.13,
      hydrology: 0.18,
      geology: 0.08,
      structure: 0.05,
      mineralization: 0.20,
      'remote-sensing': 0,
      alluvial: 0.20,
      sampling: 0,
    }),
  }),
  base: Object.freeze({
    label: 'General mineral prospectivity',
    commodity: 'gold',
    weights: Object.freeze({
      terrain: 0.12,
      hydrology: 0.10,
      geology: 0.18,
      structure: 0.15,
      mineralization: 0.20,
      'remote-sensing': 0,
      alluvial: 0.08,
      sampling: 0,
    }),
  }),
});

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
  profile = 'base',
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
    profile,
    score: clamp(score),
    confidence: clamp(confidence),
    factors: normalizeFactorMap(factors),
    source,
    metadata: Object.freeze({ ...metadata }),
  });
}
