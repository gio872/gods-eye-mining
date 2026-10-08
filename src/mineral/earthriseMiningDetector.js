/**
 * Earthrise Mining Detector adapter for GEM.
 *
 * Public Amazon Mining Watch products are used as an external mining-activity
 * evidence layer. The detector is Amazon-focused; outside its published
 * footprint the provider reports NOT_COVERED rather than "no mining".
 */
export const EARTHRISE_MINING_SOURCE = Object.freeze({
  id: 'earthrise-amazon-mining-watch',
  name: 'Earthrise Amazon Mining Watch',
  repository: 'https://github.com/earthrise-media/mining-detector',
  dataRoot: 'https://data.source.coop/earthgenome/amazon-mining-watch',
  detectionsUrl:
    'https://data.source.coop/earthgenome/amazon-mining-watch/amazon_basin_detections.geojson',
  scarMaskUrl:
    'https://data.source.coop/earthgenome/amazon-mining-watch/amazon_basin_mining_scar_masks.tif',
  license: 'CC-BY-4.0',
  codeLicense: 'MIT',
  model: '48px_v4.10b-18d-20g-21a-22bc-ensemble',
  years: Object.freeze([2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]),
  coverageName: 'Amazon basin + Andes supplemental',
});

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pointOf(feature) {
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords)) return null;
  const longitude = finite(coords[0]);
  const latitude = finite(coords[1]);
  return longitude == null || latitude == null ? null : { longitude, latitude };
}

function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLat = lat2 - lat1;
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function normalizeDetection(feature) {
  const point = pointOf(feature);
  if (!point) return null;
  const properties = feature.properties || {};
  const onsetYear = finite(
    properties.onset_year ?? properties.year ?? properties.start_year,
  );
  const confidence = finite(
    properties.confidence ?? properties.prediction ?? properties.score,
  );
  return {
    ...point,
    onsetYear,
    confidence,
    status: String(properties.status || 'unknown').toLowerCase(),
    confirmed: String(properties.status || '').toLowerCase() === 'confirmed',
    raw: properties,
  };
}

export function parseEarthriseDetections(payload) {
  const features = Array.isArray(payload?.features) ? payload.features : [];
  return features.map(normalizeDetection).filter(Boolean);
}

export function earthriseMiningEvidence(target, detections, options = {}) {
  const radiusKm = Math.max(1, Number(options.radiusKm) || 3);
  const coverageState = earthriseCoverageForPoint(
    target?.latitude,
    target?.longitude,
  );
  const coverage = coverageState === 'covered' ? 100 : 0;
  const nearby = (Array.isArray(detections) ? detections : [])
    .map((detection) => ({
      ...detection,
      distanceKm: haversineKm(target, detection),
    }))
    .filter((detection) => detection.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (!nearby.length) {
    return {
      score: null,
      coverage,
      activity: coverageState === 'covered' ? 'none_observed' : 'not_covered',
      detectionCount: 0,
      confirmedCount: 0,
      nearestDistanceKm: null,
      source: EARTHRISE_MINING_SOURCE.id,
    };
  }

  const confirmed = nearby.filter((entry) => entry.confirmed).length;
  const weighted = nearby.reduce(
    (sum, entry) =>
      sum +
      Math.exp(
        -Math.pow(entry.distanceKm / Math.max(0.75, radiusKm * 0.55), 2),
      ) *
        (entry.confirmed ? 1 : 0.65) *
        (entry.confidence == null
          ? 1
          : Math.max(0, Math.min(1, entry.confidence))),
    0,
  );
  const score = Math.min(100, weighted * 62);

  return {
    score: Math.round(score * 10) / 10,
    coverage,
    activity:
      coverageState === 'covered'
        ? confirmed > 0
          ? 'confirmed'
          : 'provisional'
        : 'not_covered',
    detectionCount: nearby.length,
    confirmedCount: confirmed,
    nearestDistanceKm: Math.round(nearby[0].distanceKm * 10) / 10,
    onsetYears: [
      ...new Set(
        nearby.map((entry) => entry.onsetYear).filter(Number.isFinite),
      ),
    ].sort((a, b) => a - b),
    source: EARTHRISE_MINING_SOURCE.id,
  };
}

export function earthriseCoverageForPoint(latitude, longitude) {
  const lat = finite(latitude);
  const lon = finite(longitude);
  if (lat == null || lon == null) return 'unknown';

  // Published Earthrise product is the Amazon basin product. This conservative
  // envelope prevents GEM from implying global coverage; a future boundary
  // pack can replace it with exact Amazon/Andes polygons.
  const amazonEnvelope = lat >= -20 && lat <= 8 && lon >= -82 && lon <= -44;
  return amazonEnvelope ? 'covered' : 'not_covered';
}

export async function fetchEarthriseDetections({
  fetchImpl = globalThis.fetch,
  signal,
  url = EARTHRISE_MINING_SOURCE.detectionsUrl,
} = {}) {
  if (typeof fetchImpl !== 'function')
    throw new TypeError('fetch is unavailable');
  const response = await fetchImpl(url, {
    signal,
    headers: { Accept: 'application/geo+json, application/json' },
  });
  if (!response.ok)
    throw new Error(
      'Earthrise Mining Watch HTTP ' +
        response.status +
        ' ' +
        response.statusText,
    );
  const payload = await response.json();
  return {
    source: EARTHRISE_MINING_SOURCE,
    detections: parseEarthriseDetections(payload),
    ok: true,
  };
}
