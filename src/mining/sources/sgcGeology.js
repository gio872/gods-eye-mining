const DEFAULT_DEPOSITS_URL =
  'https://srvags.sgc.gov.co/arcgis/rest/services/Mapa_Metalogenico_2022/Mapa_Metalogenico_Colombia_2022/MapServer/1700/query';
const DEFAULT_OCCURRENCES_URL =
  'https://srvags.sgc.gov.co/arcgis/rest/services/Mapa_Metalogenico_2016/METALOGENICO_2016/MapServer/1/query';
const DEFAULT_FAULTS_URL =
  'https://srvags.sgc.gov.co/arcgis/rest/services/Mapa_Metalogenico_2022/Mapa_Metalogenico_Colombia_2022/MapServer/1704/query';
const DEFAULT_ALLUVIAL_URL =
  'https://srvags.sgc.gov.co/arcgis/rest/services/Mapa_Metalogenico_2022/Mapa_Metalogenico_Colombia_2022/MapServer/1709/query';
const DEFAULT_GEOLOGY_URL =
  'https://srvags.sgc.gov.co/arcgis/rest/services/Mapa_Geologico_Colombia/Mapa_Geologico_Colombia_V2023/FeatureServer/733/query';

const COMMODITY_PATTERNS = Object.freeze({
  gold: [/\bau\b/i, /\boro\b/i],
  copper: [/\bcu\b/i, /cobre/i],
  silver: [/\bag\b/i, /plata/i],
  tungsten: [/\bw\b/i, /tungsteno/i, /wolframio/i],
  'rare-earth-elements': [/\bree\b/i, /tierras?\s+raras?/i],
  pgm: [/\bpge\b/i, /\bpt\b/i, /platino/i],
  coltan: [/\bnb-ta\b/i, /\bta\b/i, /\bnb\b/i, /colt[aá]n/i],
  manganese: [/\bmn\b/i, /manganeso/i],
});

function finite(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function validPoint(point) {
  const lat = finite(point?.lat);
  const lon = finite(point?.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function distanceKm(a, b) {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

function coordinatesOfGeometry(geometry, output = []) {
  if (!geometry) return output;
  if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
    output.push({
      lon: finite(geometry.coordinates[0]),
      lat: finite(geometry.coordinates[1]),
    });
    return output;
  }
  const coordinates = geometry.coordinates;
  if (Array.isArray(coordinates)) {
    if (
      coordinates.length >= 2 &&
      Number.isFinite(Number(coordinates[0])) &&
      Number.isFinite(Number(coordinates[1]))
    ) {
      output.push({
        lon: Number(coordinates[0]),
        lat: Number(coordinates[1]),
      });
    } else {
      for (const child of coordinates)
        coordinatesOfGeometry({ coordinates: child }, output);
    }
  }
  return output;
}

function pointInsideRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses =
      yi > point.lat !== yj > point.lat &&
      point.lon <
        ((xj - xi) * (point.lat - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function geometryContainsPoint(feature, point) {
  const geometry = feature?.geometry;
  if (!geometry || !validPoint(point)) return false;
  if (geometry.type === 'Polygon') {
    const ring = geometry.coordinates?.[0];
    return Array.isArray(ring) && pointInsideRing(point, ring);
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates || []).some((polygon) =>
      Array.isArray(polygon?.[0]) && pointInsideRing(point, polygon[0]),
    );
  }
  return false;
}

function nearestGeometryPointKm(point, feature) {
  const candidates = coordinatesOfGeometry(feature?.geometry);
  let nearest = Infinity;
  for (const candidate of candidates) {
    if (validPoint(candidate)) nearest = Math.min(nearest, distanceKm(point, candidate));
  }
  return Number.isFinite(nearest) ? nearest : Infinity;
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
  const patterns =
    COMMODITY_PATTERNS[commodity] || [new RegExp(String(commodity), 'i')];
  return patterns.some((pattern) => pattern.test(searchableText(feature)));
}

function statusWeight(feature) {
  const text = searchableText(feature).toLowerCase();
  if (/productor|productor pasado/.test(text)) return 1;
  if (/prospecto/.test(text)) return 0.82;
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

async function optionalRequest(url, fetchImpl, signal) {
  try {
    return await requestJson(url, fetchImpl, signal);
  } catch {
    return null;
  }
}

function weightedDistanceValue(point, features, radiusKm, { commodity, status = true } = {}) {
  let best = 0;
  let nearestKm = null;
  for (const feature of features) {
    if (commodity && !matchesCommodity(feature, commodity)) continue;
    const featurePoint = feature?.geometry?.type === 'Point'
      ? coordinatesOfGeometry(feature.geometry)[0]
      : null;
    if (!featurePoint || !validPoint(featurePoint)) continue;
    const distance = distanceKm(point, featurePoint);
    if (distance > radiusKm) continue;
    const base = status ? statusWeight(feature) : 1;
    const value = base * Math.exp(-distance / Math.max(0.1, radiusKm));
    if (value > best) {
      best = value;
      nearestKm = distance;
    }
  }
  return { value: best, nearestKm };
}

function lineDistanceValue(point, features, radiusKm, commodity = null) {
  let best = 0;
  let nearestKm = null;
  for (const feature of features) {
    if (commodity && !matchesCommodity(feature, commodity)) continue;
    const distance = nearestGeometryPointKm(point, feature);
    if (!Number.isFinite(distance) || distance > radiusKm) continue;
    const value = Math.exp(-distance / Math.max(0.1, radiusKm));
    if (value > best) {
      best = value;
      nearestKm = distance;
    }
  }
  return { value: best, nearestKm };
}

function geologyValue(point, features, commodity) {
  let best = 0;
  let matchedUnit = null;
  for (const feature of features) {
    const inside = geometryContainsPoint(feature, point);
    if (!inside) continue;
    const text = searchableText(feature).toLowerCase();
    let value = 0.35;
    if (
      commodity === 'gold' &&
      /metamorf|volcan|intrus|tonalit|granodiorit|andesit|dacita|cuarz|brecha/.test(text)
    ) value = 0.85;
    if (
      commodity === 'copper' &&
      /intrus|porfir|volcan|andesit|granodiorit|dacita/.test(text)
    ) value = 0.85;
    if (
      commodity === 'tungsten' &&
      /intrus|granit|greis|skarn|cuarz/.test(text)
    ) value = 0.85;
    if (
      commodity === 'rare-earth-elements' &&
      /carbonatit|alcalin|nefelin|pegmat/.test(text)
    ) value = 0.85;
    if (value > best) {
      best = value;
      matchedUnit = attributes(feature).SimboloUC || null;
    }
  }
  return { value: best, matchedUnit };
}

/**
 * Official Colombian geological/metallogenic evidence source.
 * Uses SGC's 2022 metallogenic map plus the 2023 geological atlas layers.
 */
export function createSgcGeologySource({
  depositsUrl = DEFAULT_DEPOSITS_URL,
  occurrencesUrl = DEFAULT_OCCURRENCES_URL,
  faultsUrl = DEFAULT_FAULTS_URL,
  alluvialUrl = DEFAULT_ALLUVIAL_URL,
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
        structureValues: points.map(() => 0),
        mineralizationValues: points.map(() => 0),
        alluvialValues: points.map(() => 0),
        source: null,
        featureCount: 0,
      };
    }

    const [
      depositsJson,
      occurrencesJson,
      faultsJson,
      alluvialJson,
      geologyJson,
    ] = await Promise.all([
      optionalRequest(queryUrl(depositsUrl, centre, radiusKm), fetchImpl, signal),
      optionalRequest(queryUrl(occurrencesUrl, centre, radiusKm), fetchImpl, signal),
      optionalRequest(queryUrl(faultsUrl, centre, radiusKm), fetchImpl, signal),
      optionalRequest(queryUrl(alluvialUrl, centre, radiusKm), fetchImpl, signal),
      optionalRequest(queryUrl(geologyUrl, centre, radiusKm), fetchImpl, signal),
    ]);

    const deposits = Array.isArray(depositsJson?.features) ? depositsJson.features : [];
    const occurrences = Array.isArray(occurrencesJson?.features) ? occurrencesJson.features : [];
    const faults = Array.isArray(faultsJson?.features) ? faultsJson.features : [];
    const alluvial = Array.isArray(alluvialJson?.features) ? alluvialJson.features : [];
    const geology = Array.isArray(geologyJson?.features) ? geologyJson.features : [];

    const mineralFeatures = [...deposits, ...occurrences];
    const mineralValues = points.map(
      (point) => weightedDistanceValue(point, mineralFeatures, radiusKm, { commodity }).value,
    );
    const structureValues = points.map(
      (point) => lineDistanceValue(point, faults, radiusKm * 0.8).value,
    );
    const alluvialValues = points.map(
      (point) => lineDistanceValue(point, alluvial, radiusKm * 0.9, commodity === 'gold' ? 'gold' : null).value,
    );
    const geologyValues = [];
    const matchedUnits = [];
    for (const point of points) {
      const result = geologyValue(point, geology, commodity);
      geologyValues.push(result.value);
      matchedUnits.push(result.matchedUnit);
    }

    const sourceParts = [];
    if (deposits.length || occurrences.length) sourceParts.push('metalogénico');
    if (faults.length) sourceParts.push('fallas');
    if (alluvial.length) sourceParts.push('aluvial');
    if (geology.length) sourceParts.push('geología');
    return {
      values: geologyValues,
      geologyValues,
      structureValues,
      mineralizationValues: mineralValues,
      alluvialValues,
      source: sourceParts.length ? `SGC 2022/2023 · ${sourceParts.join(' + ')}` : null,
      featureCount: mineralFeatures.length,
      faultFeatureCount: faults.length,
      alluvialFeatureCount: alluvial.length,
      geologyMapFeatureCount: geology.length,
      matchedUnits,
      commodity,
      searchRadiusKm: radiusKm,
    };
  }

  return Object.freeze({ getEvidence });
}

export const SGC_GEOLOGY_ENDPOINTS = Object.freeze({
  deposits: DEFAULT_DEPOSITS_URL,
  occurrences: DEFAULT_OCCURRENCES_URL,
  faults: DEFAULT_FAULTS_URL,
  alluvial: DEFAULT_ALLUVIAL_URL,
  geologyMap: DEFAULT_GEOLOGY_URL,
});
