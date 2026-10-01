const DEFAULT_STAC_URL =
  'https://planetarycomputer.microsoft.com/api/stac/v1/search';
const DEFAULT_STATS_URL =
  'https://planetarycomputer.microsoft.com/api/data/v1/item/statistics';
const DEFAULT_COLLECTION = 'hls2-s30';

function finite(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function clamp(value, min = 0, max = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function validPoint(point) {
  const lat = finite(point?.lat);
  const lon = finite(point?.lon);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

function median(values) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) return null;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2
    ? clean[middle]
    : (clean[middle - 1] + clean[middle]) / 2;
}

function robustZ(values, value) {
  if (!Number.isFinite(value)) return 0;
  const clean = values.filter(Number.isFinite);
  if (clean.length < 3) return 0;
  const centre = median(clean);
  const deviations = clean.map((candidate) => Math.abs(candidate - centre));
  const mad = median(deviations);
  if (Number.isFinite(mad) && mad > 1e-12)
    return (value - centre) / (1.4826 * mad);
  const mean = clean.reduce((sum, candidate) => sum + candidate, 0) / clean.length;
  const variance =
    clean.reduce((sum, candidate) => sum + (candidate - mean) ** 2, 0) /
    clean.length;
  const std = Math.sqrt(variance);
  return std > 1e-12 ? (value - mean) / std : 0;
}

function safeRatio(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (Math.abs(denominator) < 1e-9) return null;
  return numerator / denominator;
}

/**
 * Calculate alteration proxies from HLS-S30 surface reflectance.
 * These are remote-sensing screening indices, not mineral-identification
 * diagnostics. Positive local anomalies are scored after robust normalization.
 */
export function computeSpectralIndices(sample = {}) {
  const blue = finite(sample.B02);
  const red = finite(sample.B04);
  const nir = finite(sample.B8A);
  const swir1 = finite(sample.B11);
  const swir2 = finite(sample.B12);
  const ferric = safeRatio(red, blue);
  const ferrous = safeRatio(swir1, nir);
  const clay = safeRatio(swir1, swir2);
  const ndvi =
    Number.isFinite(nir) && Number.isFinite(red)
      ? safeRatio(nir - red, nir + red)
      : null;
  return Object.freeze({
    ferric,
    ferrous,
    clay,
    ndvi,
  });
}

function featureStatistics(response) {
  if (Array.isArray(response?.features)) return response.features;
  if (Array.isArray(response)) return response;
  return [];
}

function statsPayload(feature) {
  const properties =
    feature?.properties && typeof feature.properties === 'object'
      ? feature.properties
      : feature;
  if (!properties || typeof properties !== 'object') return {};
  return properties.statistics && typeof properties.statistics === 'object'
    ? properties.statistics
    : properties;
}

function bandMean(value) {
  if (value && typeof value === 'object') {
    for (const key of ['mean', 'median', 'value']) {
      const candidate = finite(value[key]);
      if (Number.isFinite(candidate)) return candidate;
    }
    if (Array.isArray(value.values)) {
      const values = value.values.map(finite).filter(Number.isFinite);
      if (values.length)
        return values.reduce((sum, item) => sum + item, 0) / values.length;
    }
    return null;
  }
  return finite(value);
}

function sampleFromFeature(feature) {
  const stats = statsPayload(feature);
  return {
    id: feature?.id ?? feature?.properties?.id ?? stats.id ?? null,
    B02: bandMean(stats.B02 ?? stats.blue),
    B04: bandMean(stats.B04 ?? stats.red),
    B8A: bandMean(stats.B8A ?? stats.nir),
    B11: bandMean(stats.B11 ?? stats.swir1),
    B12: bandMean(stats.B12 ?? stats.swir2),
  };
}

function bboxAround(points, radiusDegrees = 0.02) {
  const valid = points.filter(validPoint);
  if (!valid.length) return null;
  const lats = valid.map((point) => point.lat);
  const lons = valid.map((point) => point.lon);
  return {
    west: Math.max(-180, Math.min(...lons) - radiusDegrees),
    south: Math.max(-90, Math.min(...lats) - radiusDegrees),
    east: Math.min(180, Math.max(...lons) + radiusDegrees),
    north: Math.min(90, Math.max(...lats) + radiusDegrees),
  };
}

function stacItems(json) {
  return Array.isArray(json?.features)
    ? json.features.filter((item) => item?.id)
    : [];
}

function itemCloud(item) {
  return finite(
    item?.properties?.['eo:cloud_cover'] ??
      item?.properties?.cloud_cover ??
      item?.properties?.cloudCover,
  );
}

function itemTime(item) {
  const value =
    item?.properties?.datetime ??
    item?.properties?.['start_datetime'] ??
    item?.properties?.['end_datetime'];
  const millis = Date.parse(value || '');
  return Number.isFinite(millis) ? millis : 0;
}

function pickItem(items, maxCloud) {
  const eligible = items
    .filter((item) => {
      const cloud = itemCloud(item);
      return !Number.isFinite(maxCloud) || !Number.isFinite(cloud) || cloud <= maxCloud;
    })
    .slice()
    .sort((a, b) => {
      const cloudA = itemCloud(a);
      const cloudB = itemCloud(b);
      const ca = Number.isFinite(cloudA) ? cloudA : 100;
      const cb = Number.isFinite(cloudB) ? cloudB : 100;
      if (ca !== cb) return ca - cb;
      return itemTime(b) - itemTime(a);
    });
  return eligible[0] || null;
}

function getItemId(item) {
  return String(item?.id || item?.properties?.['landsat:scene_id'] || '');
}

async function fetchJson(url, fetchImpl, options = {}) {
  const response = await fetchImpl(url, options);
  if (!response?.ok)
    throw new Error(`HLS spectral request failed (${response?.status ?? 'error'})`);
  return response.json();
}

function addDays(now, days) {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

function createSearchUrl({
  stacUrl,
  collection,
  box,
  days,
  now,
  maxCloud,
}) {
  const params = new URLSearchParams({
    collections: collection,
    bbox: [box.west, box.south, box.east, box.north].join(','),
    datetime: `${addDays(now, days)}/${now.toISOString()}`,
    limit: '25',
  });
  if (Number.isFinite(maxCloud)) {
    params.set(
      'query',
      JSON.stringify({ 'eo:cloud_cover': { lte: maxCloud } }),
    );
  }
  return `${stacUrl}?${params.toString()}`;
}

function createStatsUrl({ statsUrl, collection, item }) {
  const params = new URLSearchParams({
    collection,
    item,
    unscale: 'true',
    resampling: 'bilinear',
  });
  for (const asset of ['B02', 'B04', 'B8A', 'B11', 'B12'])
    params.append('assets', asset);
  return `${statsUrl}?${params.toString()}`;
}

/**
 * HLS-S30 spectral evidence source.
 *
 * The source uses the Microsoft Planetary Computer STAC catalog to select a
 * current Sentinel-2 HLS scene, then samples B02/B04/B8A/B11/B12 through the
 * Planetary Computer statistics API. Local robust anomalies are converted to
 * a 0..1 alteration screening score.
 */
export function createHlsSpectralSource({
  stacUrl = DEFAULT_STAC_URL,
  statsUrl = DEFAULT_STATS_URL,
  collection = DEFAULT_COLLECTION,
  fetchImpl = (...args) => fetch(...args),
  days = 60,
  maxCloud = 35,
} = {}) {
  if (typeof fetchImpl !== 'function')
    throw new TypeError('A fetch implementation is required');

  async function getEvidence({
    points = [],
    center,
    signal,
  } = {}) {
    const usablePoints = points.filter(validPoint);
    const centre = validPoint(center) ? center : usablePoints[0];
    if (!centre || !usablePoints.length) {
      return {
        values: points.map(() => 0),
        source: null,
        featureCount: 0,
      };
    }

    const now = new Date();
    const box = bboxAround(usablePoints, 0.015);
    let search;
    try {
      search = await fetchJson(
        createSearchUrl({
          stacUrl,
          collection,
          box,
          days,
          now,
          maxCloud,
        }),
        fetchImpl,
        { signal, headers: { Accept: 'application/geo+json,application/json' } },
      );
    } catch (error) {
      return {
        values: points.map(() => 0),
        source: null,
        featureCount: 0,
        error: String(error?.message || error),
      };
    }

    const item = pickItem(stacItems(search), maxCloud);
    if (!item) {
      return {
        values: points.map(() => 0),
        source: null,
        featureCount: 0,
      };
    }

    const body = {
      type: 'FeatureCollection',
      features: usablePoints.map((point) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [point.lon, point.lat],
        },
        properties: { id: point.id ?? null },
      })),
    };

    let statistics;
    try {
      statistics = await fetchJson(
        createStatsUrl({
          statsUrl,
          collection,
          item: getItemId(item),
        }),
        fetchImpl,
        {
          method: 'POST',
          signal,
          headers: {
            Accept: 'application/geo+json,application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ geojson: body }),
        },
      );
    } catch (error) {
      return {
        values: points.map(() => 0),
        source: null,
        featureCount: 0,
        itemId: getItemId(item),
        error: String(error?.message || error),
      };
    }

    const samples = featureStatistics(statistics).map(sampleFromFeature);
    const byId = new Map(
      samples
        .filter((sample) => sample.id != null)
        .map((sample) => [String(sample.id), sample]),
    );
    const aligned = usablePoints.map(
      (point, index) => byId.get(String(point.id)) || samples[index] || {},
    );

    const indexRows = aligned.map(computeSpectralIndices);
    const anomaly = (key) => {
      const values = indexRows.map((row) => row[key]).filter(Number.isFinite);
      return indexRows.map((row) => clamp(Math.max(0, robustZ(values, row[key])) / 3));
    };

    const ferric = anomaly('ferric');
    const ferrous = anomaly('ferrous');
    const clay = anomaly('clay');
    const values = indexRows.map((row, index) => {
      const vegetation = Number.isFinite(row.ndvi)
        ? clamp((row.ndvi - 0.35) / 0.30)
        : 0;
      const raw =
        ferric[index] * 0.40 +
        clay[index] * 0.35 +
        ferrous[index] * 0.25;
      return clamp(raw * (1 - vegetation * 0.70));
    });

    const alignedByOriginalIndex = new Map(
      usablePoints.map((point, index) => [point.id ?? `__${index}`, values[index] ?? 0]),
    );

    return {
      values: points.map((point, index) =>
        clamp(alignedByOriginalIndex.get(point.id ?? `__${index}`) ?? 0),
      ),
      source: 'Microsoft Planetary Computer · HLS S30 (Sentinel-2)',
      featureCount: aligned.length,
      spectralAvailable: aligned.length > 0,
      itemId: getItemId(item),
      itemDatetime:
        item?.properties?.datetime ||
        item?.properties?.start_datetime ||
        null,
      cloudCover: itemCloud(item),
      method:
        'Local robust anomaly of ferric/ferrous/clay spectral proxies with vegetation suppression',
      indices: indexRows,
    };
  }

  return Object.freeze({ getEvidence });
}

export const HLS_SPECTRAL_ENDPOINTS = Object.freeze({
  stac: DEFAULT_STAC_URL,
  statistics: DEFAULT_STATS_URL,
  collection: DEFAULT_COLLECTION,
});
