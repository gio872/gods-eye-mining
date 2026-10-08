
const DEFAULT_RADIUS_DEGREES = 0.65;
const DEFAULT_MAX_FEATURES = 64;

export const GEOCHEMISTRY_SOURCES = Object.freeze({
  cmio: Object.freeze({
    id: 'cmio-geochemistry-global',
    name: 'Critical Minerals in Ores (CMMI / Geoscience Australia)',
    endpoint: 'https://services.ga.gov.au/gis/critical-minerals/ows',
    typeName: 'cmmi:CriticalMineralDepositsGeochemistry',
    sourceBias: 'Deposit-proximate compilation; useful for geochemical pathfinder priors, not an unbiased regional baseline.',
  }),
});

const PATHFINDERS = Object.freeze({
  gold: { au: 0.35, as: 0.2, sb: 0.15, w: 0.1, mo: 0.08, cu: 0.04, pb: 0.04, zn: 0.04 },
  copper: { cu: 0.35, mo: 0.2, au: 0.12, ag: 0.1, pb: 0.08, zn: 0.08, as: 0.04, re: 0.03 },
  molybdenum: { mo: 0.4, cu: 0.15, w: 0.12, re: 0.1, pb: 0.08, zn: 0.08, as: 0.07 },
  tungsten: { w: 0.35, mo: 0.2, sn: 0.15, bi: 0.1, as: 0.08, cu: 0.06, pb: 0.06 },
  lithium: { li: 0.35, cs: 0.2, rb: 0.15, be: 0.1, b: 0.1, k: 0.1 },
  nickel: { ni: 0.3, co: 0.2, cr: 0.15, cu: 0.1, s: 0.1, mg: 0.1, fe: 0.05 },
  cobalt: { co: 0.35, ni: 0.2, cu: 0.12, mn: 0.1, fe: 0.08, as: 0.08, zn: 0.07 },
  platinum: { pt: 0.32, pd: 0.28, ni: 0.15, cu: 0.1, cr: 0.07, co: 0.05, fe: 0.03 },
  palladium: { pd: 0.32, pt: 0.28, ni: 0.15, cu: 0.1, cr: 0.07, co: 0.05, fe: 0.03 },
  iridium: { ir: 0.35, pt: 0.2, pd: 0.18, ni: 0.12, cr: 0.08, co: 0.04, fe: 0.03 },
  rhodium: { rh: 0.35, pt: 0.2, pd: 0.18, ni: 0.12, cr: 0.08, co: 0.04, fe: 0.03 },
  manganese: { mn: 0.35, fe: 0.2, co: 0.15, ni: 0.12, cu: 0.08, zn: 0.05, as: 0.05 },
  uranium: { u: 0.4, th: 0.16, v: 0.12, mo: 0.1, pb: 0.08, as: 0.07, se: 0.07 },
  phosphate: { p: 0.45, ca: 0.2, sr: 0.12, ce: 0.08, la: 0.05, y: 0.05, u: 0.05 },
  potash: { k: 0.45, na: 0.2, rb: 0.15, cs: 0.1, mg: 0.1 },
  rareearth: { ce: 0.2, la: 0.15, nd: 0.15, pr: 0.1, sm: 0.1, y: 0.1, th: 0.1, u: 0.1 },
});

const ELEMENT_ALIASES = Object.freeze({
  au: ['au', 'gold'], ag: ['ag', 'silver'], as: ['as', 'arsenic'], sb: ['sb', 'antimony'],
  w: ['w', 'tungsten', 'wolfram'], mo: ['mo', 'molybdenum'], cu: ['cu', 'copper'],
  pb: ['pb', 'lead'], zn: ['zn', 'zinc'], re: ['re', 'rhenium'], sn: ['sn', 'tin'],
  bi: ['bi', 'bismuth'], li: ['li', 'lithium'], cs: ['cs', 'cesium'], rb: ['rb', 'rubidium'],
  be: ['be', 'beryllium'], b: ['b', 'boron'], k: ['k', 'potassium'], ni: ['ni', 'nickel'],
  co: ['co', 'cobalt'], cr: ['cr', 'chromium'], s: ['s', 'sulfur', 'sulphur'],
  mg: ['mg', 'magnesium'], fe: ['fe', 'iron'], pt: ['pt', 'platinum'], pd: ['pd', 'palladium'],
  ir: ['ir', 'iridium'], rh: ['rh', 'rhodium'], mn: ['mn', 'manganese'], u: ['u', 'uranium'],
  th: ['th', 'thorium'], v: ['v', 'vanadium'], se: ['se', 'selenium'], p: ['p', 'phosphorus'],
  ca: ['ca', 'calcium'], sr: ['sr', 'strontium'], ce: ['ce', 'cerium'], la: ['la', 'lanthanum'],
  nd: ['nd', 'neodymium'], pr: ['pr', 'praseodymium'], sm: ['sm', 'samarium'], y: ['y', 'yttrium'],
  na: ['na', 'sodium'],
});

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function normalizeKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizeConcentration(key, rawValue) {
  const value = finite(rawValue);
  if (value == null || value < 0) return null;
  const normalized = normalizeKey(key);
  if (normalized.includes('ppb')) return value / 1000;
  if (normalized.includes('pct') || normalized.includes('percent')) return value * 10000;
  return value;
}

function haversineKm(a, b) {
  const lat1 = (Number(a.latitude) * Math.PI) / 180;
  const lat2 = (Number(b.latitude) * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = ((Number(b.longitude) - Number(a.longitude)) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function extractElementMap(properties) {
  const result = {};
  for (const [rawKey, rawValue] of Object.entries(properties || {})) {
    const normalized = normalizeKey(rawKey);
    if (!normalized) continue;
    for (const [element, aliases] of Object.entries(ELEMENT_ALIASES)) {
      if (result[element] == null && aliases.some((alias) => normalized === alias || normalized.startsWith(alias))) {
        const value = normalizeConcentration(rawKey, rawValue);
        if (value != null) result[element] = value;
      }
    }
  }
  return result;
}

function featurePoint(feature) {
  const geometry = feature && feature.geometry;
  const coordinates = geometry && geometry.type === 'Point' ? geometry.coordinates : null;
  if (!Array.isArray(coordinates)) return null;
  const longitude = finite(coordinates[0]);
  const latitude = finite(coordinates[1]);
  return longitude == null || latitude == null ? null : { longitude, latitude };
}

function robustCenter(values) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  return clean.length ? clean[Math.floor(clean.length / 2)] : null;
}

function mad(values, center) {
  return robustCenter(values.filter(Number.isFinite).map((value) => Math.abs(value - center)));
}

function sigmoid(value) {
  return 100 / (1 + Math.exp(-value));
}

export function extractGeochemistrySamples(features) {
  return (Array.isArray(features) ? features : [])
    .map((feature) => {
      const point = featurePoint(feature);
      if (!point) return null;
      const elements = extractElementMap(feature.properties || {});
      return Object.keys(elements).length
        ? { ...point, elements, sourceId: GEOCHEMISTRY_SOURCES.cmio.id, sourceName: GEOCHEMISTRY_SOURCES.cmio.name }
        : null;
    })
    .filter(Boolean);
}

export async function queryGeochemistry(target, {
  fetchImpl = globalThis.fetch,
  signal,
  radiusDegrees = DEFAULT_RADIUS_DEGREES,
  maxFeatures = DEFAULT_MAX_FEATURES,
} = {}) {
  const west = Math.max(-180, Number(target.longitude) - radiusDegrees);
  const south = Math.max(-90, Number(target.latitude) - radiusDegrees);
  const east = Math.min(180, Number(target.longitude) + radiusDegrees);
  const north = Math.min(90, Number(target.latitude) + radiusDegrees);

  const url = new URL(GEOCHEMISTRY_SOURCES.cmio.endpoint);
  url.searchParams.set('service', 'WFS');
  url.searchParams.set('version', '1.1.0');
  url.searchParams.set('request', 'GetFeature');
  url.searchParams.set('typeName', GEOCHEMISTRY_SOURCES.cmio.typeName);
  url.searchParams.set('outputFormat', 'application/json');
  url.searchParams.set('srsName', 'EPSG:4326');
  url.searchParams.set('bbox', [west, south, east, north].join(',') + ',EPSG:4326');
  url.searchParams.set('maxFeatures', String(maxFeatures));

  try {
    const response = await fetchImpl(url, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + response.statusText);
    const payload = await response.json();
    return {
      ok: true,
      samples: extractGeochemistrySamples(payload && payload.features),
      sourceId: GEOCHEMISTRY_SOURCES.cmio.id,
      sourceName: GEOCHEMISTRY_SOURCES.cmio.name,
    };
  } catch (error) {
    return {
      ok: false,
      samples: [],
      sourceId: GEOCHEMISTRY_SOURCES.cmio.id,
      sourceName: GEOCHEMISTRY_SOURCES.cmio.name,
      error,
    };
  }
}

function targetCommodityKeys(target) {
  const text = [
    ...(target && Array.isArray(target.commodities) ? target.commodities : []),
    target && target.nearestReference,
  ].filter(Boolean).join(' ').toLowerCase();
  const aliases = {
    gold: 'gold', au: 'gold', copper: 'copper', cu: 'copper', tungsten: 'tungsten', wolfram: 'tungsten',
    molybdenum: 'molybdenum', lithium: 'lithium', li: 'lithium', nickel: 'nickel', ni: 'nickel',
    cobalt: 'cobalt', co: 'cobalt', platinum: 'platinum', pt: 'platinum', palladium: 'palladium',
    pd: 'palladium', iridium: 'iridium', ir: 'iridium', rhodium: 'rhodium', rh: 'rhodium',
    manganese: 'manganese', mn: 'manganese', uranium: 'uranium', u: 'uranium', phosphate: 'phosphate',
    potash: 'potash', 'rare earth': 'rareearth', ree: 'rareearth',
  };
  return [...new Set(Object.entries(aliases).filter(([alias]) => text.includes(alias)).map(([, commodity]) => commodity))];
}

function elementScore(values, estimate) {
  if (!values.length || !Number.isFinite(estimate) || estimate <= 0) return null;
  const logs = values.map((value) => Math.log1p(value));
  const center = robustCenter(logs);
  if (center == null) return null;
  const deviation = mad(logs, center);
  const scale = Math.max(0.12, Number(deviation) * 1.4826);
  const z = (Math.log1p(estimate) - center) / scale;
  return Math.round(clamp(sigmoid(z / 1.75)) * 10) / 10;
}

function estimateElement(samples, target, element) {
  const nearby = samples.map((sample) => {
    const value = finite(sample.elements[element]);
    if (value == null) return null;
    const distance = haversineKm(target, sample);
    return Number.isFinite(distance) ? { value, distance, weight: 1 / Math.max(1, distance) ** 1.35 } : null;
  }).filter(Boolean).sort((a, b) => a.distance - b.distance);
  if (!nearby.length) return null;
  const selected = nearby.slice(0, 12);
  const totalWeight = selected.reduce((sum, item) => sum + item.weight, 0);
  const estimate = selected.reduce((sum, item) => sum + item.value * item.weight, 0) / Math.max(totalWeight, 1e-9);
  return {
    estimate,
    nearestDistanceKm: selected[0].distance,
    sampleCount: selected.length,
    distribution: samples.map((sample) => finite(sample.elements[element])).filter(Number.isFinite),
  };
}

export function rankGeochemistryHypotheses(target, samples, requestedCommodities = null) {
  const commodities = Array.isArray(requestedCommodities) && requestedCommodities.length
    ? requestedCommodities
    : targetCommodityKeys(target);
  const selected = commodities.length ? commodities : Object.keys(PATHFINDERS);
  const ranked = [];
  for (const commodity of selected) {
    const prior = PATHFINDERS[commodity];
    if (!prior) continue;
    let weighted = 0;
    let totalWeight = 0;
    const analytes = {};
    for (const [element, weight] of Object.entries(prior)) {
      const estimate = estimateElement(samples, target, element);
      if (!estimate) continue;
      const score = elementScore(estimate.distribution, estimate.estimate);
      if (score == null) continue;
      weighted += score * weight;
      totalWeight += weight;
      analytes[element] = {
        score,
        estimate: Math.round(estimate.estimate * 1000) / 1000,
        nearestDistanceKm: Math.round(estimate.nearestDistanceKm * 10) / 10,
        sampleCount: estimate.sampleCount,
      };
    }
    if (totalWeight > 0) {
      ranked.push({
        commodity,
        score: Math.round((weighted / totalWeight) * 10) / 10,
        analytes,
        sampleCount: samples.length,
      });
    }
  }
  return ranked.sort((a, b) => b.score - a.score);
}

export function geochemistryScore(target, samples, options = {}) {
  const ranked = rankGeochemistryHypotheses(target, Array.isArray(samples) ? samples : [], options.commodities);
  const best = ranked[0] || null;
  return best ? {
    score: best.score,
    commodity: best.commodity,
    hypotheses: ranked.slice(0, 5),
    sampleCount: best.sampleCount,
  } : null;
}

export { PATHFINDERS };
