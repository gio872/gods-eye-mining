const DEFAULT_DEPOSITS_URL =
  'https://srvags.sgc.gov.co/arcgis/rest/services/Mapa_Metalogenico_2022/Mapa_Metalogenico_Colombia_2022/MapServer/1700/query';
const DEFAULT_OCCURRENCES_URL =
  'https://srvags.sgc.gov.co/arcgis/rest/services/Mapa_Metalogenico_2016/METALOGENICO_2016/MapServer/1/query';
const DEFAULT_FAULTS_URL =
  'https://srvags.sgc.gov.co/arcgis/rest/services/Mapa_Metalogenico_2022/Mapa_Metalogenico_Colombia_2022/MapServer/1704/query';
const DEFAULT_LINEAMENTS_URL =
  'https://srvags.sgc.gov.co/arcgis/rest/services/Mapa_Metalogenico_2022/Mapa_Metalogenico_Colombia_2022/MapServer/1708/query';
const DEFAULT_ALLUVIAL_URL =
  'https://srvags.sgc.gov.co/arcgis/rest/services/Mapa_Metalogenico_2022/Mapa_Metalogenico_Colombia_2022/MapServer/1709/query';
const DEFAULT_GEOLOGY_URL =
  'https://srvags.sgc.gov.co/arcgis/rest/services/Mapa_Geologico_Colombia/Mapa_Geologico_Colombia_V2023/FeatureServer/733/query';
const DEFAULT_DRAINAGE_SIMPLE_URL =
  'https://srvags.sgc.gov.co/arcgis/rest/services/Mapa_Geologico_Colombia/Mapa_Geologico_Colombia_V2023/FeatureServer/728/query';
const DEFAULT_DRAINAGE_DOUBLE_URL =
  'https://srvags.sgc.gov.co/arcgis/rest/services/Mapa_Geologico_Colombia/Mapa_Geologico_Colombia_V2023/FeatureServer/729/query';
const DEFAULT_GEOCHEMISTRY_URL =
  'https://srvags.sgc.gov.co/arcprod/rest/services/Geoquimica_Portal/Atlas_Geoquimico_2020/MapServer';

const GEOCHEMISTRY_LAYERS = Object.freeze({
  ag: 0,
  au: 3,
  cu: 13,
});

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
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

function geometryPoints(geometry, output = []) {
  if (!geometry) return output;
  if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
    output.push({
      lon: finite(geometry.coordinates[0]),
      lat: finite(geometry.coordinates[1]),
    });
    return output;
  }
  const coordinates = geometry.coordinates;
  if (!Array.isArray(coordinates)) return output;
  if (
    coordinates.length >= 2 &&
    Number.isFinite(Number(coordinates[0])) &&
    Number.isFinite(Number(coordinates[1]))
  ) {
    output.push({
      lon: Number(coordinates[0]),
      lat: Number(coordinates[1]),
    });
    return output;
  }
  for (const child of coordinates) geometryPoints({ coordinates: child }, output);
  return output;
}

function linePathsOfGeometry(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'LineString')
    return Array.isArray(geometry.coordinates) ? [geometry.coordinates] : [];
  if (geometry.type === 'MultiLineString')
    return Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
  return [];
}

function pointInsideRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (!Array.isArray(a) || !Array.isArray(b)) continue;
    const [xi, yi] = a;
    const [xj, yj] = b;
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

function pointToSegmentKm(point, a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return Infinity;
  const ax = (Number(a[0]) - point.lon) * Math.cos((point.lat * Math.PI) / 180) * 111.32;
  const ay = (Number(a[1]) - point.lat) * 111.32;
  const bx = (Number(b[0]) - point.lon) * Math.cos((point.lat * Math.PI) / 180) * 111.32;
  const by = (Number(b[1]) - point.lat) * 111.32;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared > 0
      ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared))
      : 0;
  const px = ax + t * dx;
  const py = ay + t * dy;
  return Math.hypot(px, py);
}

function nearestGeometryDistanceKm(point, feature) {
  const geometry = feature?.geometry;
  const paths = linePathsOfGeometry(geometry);
  let nearest = Infinity;
  for (const path of paths) {
    for (let i = 1; i < path.length; i += 1) {
      nearest = Math.min(nearest, pointToSegmentKm(point, path[i - 1], path[i]));
    }
  }
  if (Number.isFinite(nearest)) return nearest;
  for (const candidate of geometryPoints(geometry)) {
    if (validPoint(candidate)) nearest = Math.min(nearest, distanceKm(point, candidate));
  }
  return nearest;
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

function identifyUrl(url, point, radiusKm) {
  const deltaLat = radiusKm / 111.32;
  const deltaLon =
    radiusKm /
    (111.32 * Math.max(0.05, Math.cos((point.lat * Math.PI) / 180)));
  const params = new URLSearchParams({
    f: 'json',
    geometry: `${point.lon},${point.lat}`,
    geometryType: 'esriGeometryPoint',
    sr: '4326',
    layers: `all:${GEOCHEMISTRY_LAYERS.ag},${GEOCHEMISTRY_LAYERS.au},${GEOCHEMISTRY_LAYERS.cu}`,
    tolerance: '1',
    mapExtent: [
      point.lon - deltaLon,
      point.lat - deltaLat,
      point.lon + deltaLon,
      point.lat + deltaLat,
    ].join(','),
    imageDisplay: '1024,1024,96',
    returnGeometry: 'false',
  });
  return `${url.replace(/\/$/, '')}/identify?${params}`;
}

async function requestJson(url, fetchImpl, signal, options = {}) {
  const response = await fetchImpl(url, {
    signal,
    redirect: 'error',
    headers: { Accept: 'application/geo+json,application/json' },
    ...options,
  });
  if (!response?.ok)
    throw new Error(`SGC exploration request failed (${response.status ?? 'error'})`);
  return response.json();
}

async function optionalRequest(url, fetchImpl, signal, options = {}) {
  try {
    return await requestJson(url, fetchImpl, signal, options);
  } catch {
    return null;
  }
}

async function mapConcurrent(items, concurrency, mapper) {
  const results = Array(items.length);
  let cursor = 0;
  async function worker() {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }
  const workers = Math.min(Math.max(1, concurrency), items.length || 1);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

function weightedDistanceValue(point, features, radiusKm, { commodity, status = true } = {}) {
  let best = 0;
  let nearestKm = null;
  for (const feature of features) {
    if (commodity && !matchesCommodity(feature, commodity)) continue;
    const featurePoint =
      feature?.geometry?.type === 'Point' ? geometryPoints(feature.geometry)[0] : null;
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

function lineDistanceValue(
  point,
  features,
  radiusKm,