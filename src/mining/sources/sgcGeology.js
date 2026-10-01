const DEFAULT_DEPOSITS_URL =
  'https://srvags.sgc.gov.co/arcgis/rest/services/Mapa_Metalogenico_2016/METALOGENICO_2016/MapServer/0/query';
const DEFAULT_OCCURRENCES_URL =
  'https://srvags.sgc.gov.co/arcgis/rest/services/Mapa_Metalogenico_2016/METALOGENICO_2016/MapServer/1/query';
const DEFAULT_GEOLOGY_URL =
  'https://srvags.sgc.gov.co/arcgis/rest/services/Mapa_Geologico_Colombia/Mapa_Geologico_Colombia_V2023/FeatureServer/733/query';

const COMMODITY_PATTERNS = Object.freeze({
  gold: [/au/i, /pt_au/i],
  copper: [/cu/i],
  silver: [/ag/i],
  tungsten: [/w/i],
  'rare-earth-elements': [/ree/i, /tierras?s+raras?/i],
  pgm: [/pge/i, /pt/i, /crs*(s*pges*)/i],
  coltan: [/nb-ta/i, /ta/i, /nb/i],
  manganese: [/mn/i],
});

function finite(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
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

function distanceKm(a, b) {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function centreOfFeature(feature) {
  const geometry = feature?.geometry;
  const coordinates = geometry?.coordinates;
  if (geometry?.type === 'Point' && Array.isArray(coordinates)) {
    return { lon: finite(coordinates[0]), lat: finite(coordinates[1]) };
  }
  const centroid = feature?.centroid;
  if (centroid) return { lon: finite(centroid.x), lat: finite(centroid.y) };
  return null;
}

function attributes(feature) {
  return feature?.properties && typeof feature.properties === 'object'
    ? feature.properties
    : feature?.attributes && typeof feature.attributes === 'object'
      ? feature.attributes
      : {};
}

function searchableText(feature) {
  return Object.values(attributes(feature))
    .filter((value) => value != null)
    .join(' ');
}

function matchesCommodity(feature, commodity) {
  const patterns = COMMODITY_PATTERNS[commodity] || [new RegExp(String(commodity), 'i')];
  const text = searchableText(feature);
  return patterns.some((pattern) => pattern.test(text));
}

function statusWeight(feature) {
  const text = searchableText(feature).toLowerCase();
  if (/productor|productor pasado/.test(text)) return 1;
  if (/prospecto/.test(text)) return 0.8;
  if (/ocurrencia|manifestacion/.test(text)) return 0.65;
  if (/anomalia/.test(text)) return 0.5;
  return 0.6;
}

function queryUrl(url, centre, radiusKm) {
  const params = new URLSearchParams({
    f: 'geojson',
    where: '1=1',
    geometry: JSON.stringify({
      x: centre.lon,
      y: centre.lat,
      spatialReference: { wkid: 4326 },
    }),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    distance: String(radiusKm * 1000),
    units: 'esriSRUnit_Meter',
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
  });
  return `${url}?${params}`;
}

async function requestJson(url, fetchImpl, signal) {
  const response = await fetchImpl(url, {
    signal,
    redirect: 'error',
    headers: { Accept: 'application/geo+json,application/json' },
  });
  if (!response.ok)
    throw new Error(`SGC geology request failed (${response.status})`);
  return response.json();
}

/**
 * Official Colombian geological/metallogenic evidence source.
 * The SGC services are queried as read-only public GIS sources.
 */
export function createSgcGeologySource({
  depositsUrl = DEFAULT_DEPOSITS_URL,
  occurrencesUrl = DEFAULT_OCCURRENCES_URL,
  geologyUrl = DEFAULT_GEOLOGY_URL,
  fetchImpl = (...args) => fetch(...args),
  radiusKm = 7,
} = {}) {
  if (typeof fetchImpl !== 'function')
    throw new TypeError('A fetch implementation is required');

  async function getEvidence({
    points = [],
    center,
    commodity = 'gold',
    signal,
  } = {}) {
    const usablePoints = points.filter(validPoint);
    const centre = validPoint(center) ? center : usablePoints[0];
    if (!centre) {
      return {
        values: points.map(() => 0),
        source: null,
        featureCount: 0,
        geologyMapFeatureCount: 0,
      };
    }

    const [deposits, occurrences, geology] = await Promise.all([
      requestJson(queryUrl(depositsUrl, centre, radiusKm), fetchImpl, signal),
      requestJson(queryUrl(occurrencesUrl, centre, radiusKm), fetchImpl, signal),
      requestJson(queryUrl(geologyUrl, centre, radiusKm), fetchImpl, signal),
    ]);

    const depositFeatures = Array.isArray(deposits?.features)
      ? deposits.features
      : [];
    const occurrenceFeatures = Array.isArray(occurrences?.features)
      ? occurrences.features
      : [];
    const geologyFeatures = Array.isArray(geology?.features)
      ? geology.features
      : [];

    const mineralFeatures = [...depositFeatures, ...occurrenceFeatures]
      .filter((feature) => matchesCommodity(feature, commodity))
      .map((feature) => ({
        feature,
        point: centreOfFeature(feature),
        weight: statusWeight(feature),
      }))
      .filter(({ point }) => point && validPoint(point));

    const values = points.map((point) => {
      if (!validPoint(point) || mineralFeatures.length === 0) return 0;
      let best = 0;
      for (const item of mineralFeatures) {
        const distance = distanceKm(point, item.point);
        const decay = Math.exp(-distance / radiusKm);
        best = Math.max(best, item.weight * decay);
      }
      return best;
    });

    return {
      values,
      source: mineralFeatures.length
        ? 'SGC · Metalogenia 2016 + Mapa Geológico 2023'
        : geologyFeatures.length
          ? 'SGC · Mapa Geológico 2023'
          : null,
      featureCount: mineralFeatures.length,
      geologyMapFeatureCount: geologyFeatures.length,
      commodity,
      searchRadiusKm: radiusKm,
    };
  }

  return Object.freeze({
    getEvidence,
  });
}

export const SGC_GEOLOGY_ENDPOINTS = Object.freeze({
  deposits: DEFAULT_DEPOSITS_URL,
  occurrences: DEFAULT_OCCURRENCES_URL,
  geologyMap: DEFAULT_GEOLOGY_URL,
});
