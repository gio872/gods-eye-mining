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
  'geochemistry',
  'lineaments',
  'drainage',
  'sampling',
  'geophysics',
]);

export const PROSPECTIVITY_PROFILES = Object.freeze({
  'gold-lode': Object.freeze({
    label: 'Gold · hard-rock / lode',
    commodity: 'gold',
    weights: Object.freeze({
      terrain: 0.06,
      hydrology: 0.03,
      geology: 0.15,
      structure: 0.12,
      mineralization: 0.19,
      'remote-sensing': 0.16,
      alluvial: 0.03,
      geochemistry: 0.14,
      lineaments: 0.08,
      drainage: 0.04,
      sampling: 0,
      geophysics: 0.10,
    }),
  }),
  'gold-alluvial': Object.freeze({
    label: 'Gold · alluvial',
    commodity: 'gold',
    weights: Object.freeze({
      terrain: 0.1,
      hydrology: 0.12,
      geology: 0.08,
      structure: 0.05,
      mineralization: 0.18,
      'remote-sensing': 0.12,
      alluvial: 0.15,
      geochemistry: 0.12,
      lineaments: 0.03,
      drainage: 0.05,
      sampling: 0,
      geophysics: 0.10,
    }),
  }),
  base: Object.freeze({
    label: 'General mineral prospectivity',
    commodity: 'gold',
    weights: Object.freeze({
      terrain: 0.1,
      hydrology: 0.08,
      geology: 0.16,
      structure: 0.12,
      mineralization: 0.17,
      'remote-sensing': 0.1,
      alluvial: 0.05,
      geochemistry: 0.1,
      lineaments: 0.06,
      drainage: 0.06,
      sampling: 0,
      geophysics: 0.10,
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
