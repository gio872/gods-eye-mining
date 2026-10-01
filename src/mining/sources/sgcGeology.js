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
  for (const child of coordinates)
    geometryPoints({ coordinates: child }, output);
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
    return (geometry.coordinates || []).some(
      (polygon) =>
        Array.isArray(polygon?.[0]) && pointInsideRing(point, polygon[0]),
    );
  }
  return false;
}

function pointToSegmentKm(point, a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return Infinity;
  const ax =
    (Number(a[0]) - point.lon) * Math.cos((point.lat * Math.PI) / 180) * 111.32;
  const ay = (Number(a[1]) - point.lat) * 111.32;
  const bx =
    (Number(b[0]) - point.lon) * Math.cos((point.lat * Math.PI) / 180) * 111.32;
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
      nearest = Math.min(
        nearest,
        pointToSegmentKm(point, path[i - 1], path[i]),
      );
    }
  }
  if (Number.isFinite(nearest)) return nearest;
  for (const candidate of geometryPoints(geometry)) {
    if (validPoint(candidate))
      nearest = Math.min(nearest, distanceKm(point, candidate));
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
  const patterns = COMMODITY_PATTERNS[commodity] || [
    new RegExp(String(commodity), 'i'),
  ];
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
    radiusKm / (111.32 * Math.max(0.05, Math.cos((point.lat * Math.PI) / 180)));
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
  return url.replace(/\/$/, '') + '/identify?' + params;
}

async function requestJson(url, fetchImpl, signal, options = {}) {
  const response = await fetchImpl(url, {
    signal,
    redirect: 'error',
    headers: { Accept: 'application/geo+json,application/json' },
    ...options,
  });
  if (!response?.ok)
    throw new Error(
      `SGC exploration request failed (${response.status ?? 'error'})`,
    );
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

function weightedDistanceValue(
  point,
  features,
  radiusKm,
  { commodity, status = true } = {},
) {
  let best = 0;
  let nearestKm = null;
  for (const feature of features) {
    if (commodity && !matchesCommodity(feature, commodity)) continue;
    const featurePoint =
      feature?.geometry?.type === 'Point'
        ? geometryPoints(feature.geometry)[0]
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

function lineDistanceValue(
  point,
  features,
  radiusKm,
  commodity = null,
  baseWeight = () => 1,
) {
  let best = 0;
  let nearestKm = null;
  for (const feature of features) {
    if (commodity && !matchesCommodity(feature, commodity)) continue;
    const distance = nearestGeometryDistanceKm(point, feature);
    if (!Number.isFinite(distance) || distance > radiusKm) continue;
    const value =
      Number(baseWeight(feature)) *
      Math.exp(-distance / Math.max(0.1, radiusKm));
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
    if (!geometryContainsPoint(feature, point)) continue;
    const text = searchableText(feature).toLowerCase();
    let value = 0.35;
    if (
      commodity === 'gold' &&
      /metamorf|volcan|intrus|tonalit|granodiorit|andesit|dacita|cuarz|brecha/.test(
        text,
      )
    )
      value = 0.85;
    if (
      commodity === 'copper' &&
      /intrus|porfir|volcan|andesit|granodiorit|dacita/.test(text)
    )
      value = 0.85;
    if (
      commodity === 'tungsten' &&
      /intrus|granit|greis|skarn|cuarz/.test(text)
    )
      value = 0.85;
    if (
      commodity === 'rare-earth-elements' &&
      /carbonatit|alcalin|nefelin|pegmat/.test(text)
    )
      value = 0.85;
    if (value > best) {
      best = value;
      matchedUnit = attributes(feature).SimboloUC || null;
    }
  }
  return { value: best, matchedUnit };
}

function robustZ(values, value) {
  const clean = values.filter(Number.isFinite);
  if (!Number.isFinite(value) || clean.length < 3) return 0;
  const ordered = [...clean].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  const median =
    ordered.length % 2
      ? ordered[middle]
      : (ordered[middle - 1] + ordered[middle]) / 2;
  const deviations = ordered.map((candidate) => Math.abs(candidate - median));
  const mad = deviations[Math.floor(deviations.length / 2)] ?? 0;
  if (mad > 1e-12) return (value - median) / (1.4826 * mad);
  const mean =
    clean.reduce((sum, candidate) => sum + candidate, 0) / clean.length;
  const std = Math.sqrt(
    clean.reduce((sum, candidate) => sum + (candidate - mean) ** 2, 0) /
      clean.length,
  );
  return std > 1e-12 ? (value - mean) / std : 0;
}

function positiveAnomaly(values) {
  const clean = values.filter(Number.isFinite);
  return values.map((value) =>
    Number.isFinite(value) && clean.length >= 3
      ? Math.min(1, Math.max(0, robustZ(clean, value) / 3))
      : 0,
  );
}

function geochemistryComposite(commodity, au, ag, cu) {
  const weights =
    commodity === 'gold'
      ? { au: 0.65, ag: 0.2, cu: 0.15 }
      : commodity === 'silver'
        ? { ag: 0.55, au: 0.3, cu: 0.15 }
        : commodity === 'copper'
          ? { cu: 0.7, au: 0.2, ag: 0.1 }
          : { au: 0.34, ag: 0.33, cu: 0.33 };
  const parts = [
    ['au', au, weights.au],
    ['ag', ag, weights.ag],
    ['cu', cu, weights.cu],
  ];
  let numerator = 0;
  let denominator = 0;
  for (const [, value, weight] of parts) {
    if (!Number.isFinite(value)) continue;
    numerator += value * weight;
    denominator += weight;
  }
  return denominator > 0 ? numerator / denominator : 0;
}

function lineamentWeight(feature) {
  const text = searchableText(feature).toLowerCase();
  if (/magn[eé]tico/.test(text)) return 0.95;
  if (/l[ií]mite de dominios/.test(text)) return 0.65;
  return 0.55;
}

function drainageValue(point, simpleLines, doubleDrainage, radiusKm) {
  const simpleNearby = [];
  for (const feature of simpleLines) {
    const distance = nearestGeometryDistanceKm(point, feature);
    if (Number.isFinite(distance) && distance <= radiusKm)
      simpleNearby.push({
        distance,
        permanent: String(attributes(feature).ESTADO_DRENAJE ?? '') === '5101',
      });
  }
  const density = Math.min(1, simpleNearby.length / 12);
  const permanentCount = simpleNearby.filter((row) => row.permanent).length;
  const permanentFraction =
    simpleNearby.length > 0 ? permanentCount / simpleNearby.length : 0;

  let doubleScore = 0;
  for (const feature of doubleDrainage) {
    if (geometryContainsPoint(feature, point)) {
      doubleScore = 1;
      break;
    }
    const distance = nearestGeometryDistanceKm(point, feature);
    if (Number.isFinite(distance) && distance <= radiusKm)
      doubleScore = Math.max(
        doubleScore,
        Math.exp(-distance / Math.max(0.1, radiusKm)),
      );
  }

  return Math.min(
    1,
    density * 0.55 + permanentFraction * 0.25 + doubleScore * 0.2,
  );
}

async function identifyGeochemistry(
  point,
  radiusKm,
  geochemistryUrl,
  fetchImpl,
  signal,
) {
  const json = await optionalRequest(
    identifyUrl(geochemistryUrl, point, radiusKm),
    fetchImpl,
    signal,
  );
  const values = { au: null, ag: null, cu: null };
  for (const row of Array.isArray(json?.results) ? json.results : []) {
    const layerId = finite(row?.layerId);
    const value = finite(
      row?.value ?? row?.attributes?.value ?? row?.attributes?.Value,
    );
    if (!Number.isFinite(value)) continue;
    if (layerId === GEOCHEMISTRY_LAYERS.au) values.au = value;
    if (layerId === GEOCHEMISTRY_LAYERS.ag) values.ag = value;
    if (layerId === GEOCHEMISTRY_LAYERS.cu) values.cu = value;
  }
  return values;
}

/**
 * Official Colombian SGC exploration evidence source.
 * Combines metallogenic deposits/occurrences, mapped geology, faults,
 * geophysical lineaments, alluvial districts, drainage, and Au/Ag/Cu
 * sediment-geochemistry anomalies.
 */
export function createSgcGeologySource({
  depositsUrl = DEFAULT_DEPOSITS_URL,
  occurrencesUrl = DEFAULT_OCCURRENCES_URL,
  faultsUrl = DEFAULT_FAULTS_URL,
  lineamentsUrl = DEFAULT_LINEAMENTS_URL,
  alluvialUrl = DEFAULT_ALLUVIAL_URL,
  geologyUrl = DEFAULT_GEOLOGY_URL,
  drainageSimpleUrl = DEFAULT_DRAINAGE_SIMPLE_URL,
  drainageDoubleUrl = DEFAULT_DRAINAGE_DOUBLE_URL,
  geochemistryUrl = DEFAULT_GEOCHEMISTRY_URL,
  geochemistryConcurrency = 8,
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
        geologyValues: points.map(() => 0),
        structureValues: points.map(() => 0),
        mineralizationValues: points.map(() => 0),
        alluvialValues: points.map(() => 0),
        lineamentValues: points.map(() => 0),
        drainageValues: points.map(() => 0),
        geochemistryValues: points.map(() => 0),
        auAnomalyValues: points.map(() => 0),
        agAnomalyValues: points.map(() => 0),
        cuAnomalyValues: points.map(() => 0),
        source: null,
        featureCount: 0,
      };
    }

    const [
      depositsJson,
      occurrencesJson,
      faultsJson,
      lineamentsJson,
      alluvialJson,
      geologyJson,
      drainageSimpleJson,
      drainageDoubleJson,
    ] = await Promise.all([
      optionalRequest(
        queryUrl(depositsUrl, centre, radiusKm),
        fetchImpl,
        signal,
      ),
      optionalRequest(
        queryUrl(occurrencesUrl, centre, radiusKm),
        fetchImpl,
        signal,
      ),
      optionalRequest(queryUrl(faultsUrl, centre, radiusKm), fetchImpl, signal),
      optionalRequest(
        queryUrl(lineamentsUrl, centre, radiusKm),
        fetchImpl,
        signal,
      ),
      optionalRequest(
        queryUrl(alluvialUrl, centre, radiusKm),
        fetchImpl,
        signal,
      ),
      optionalRequest(
        queryUrl(geologyUrl, centre, radiusKm),
        fetchImpl,
        signal,
      ),
      optionalRequest(
        queryUrl(drainageSimpleUrl, centre, radiusKm),
        fetchImpl,
        signal,
      ),
      optionalRequest(
        queryUrl(drainageDoubleUrl, centre, radiusKm),
        fetchImpl,
        signal,
      ),
    ]);

    const deposits = Array.isArray(depositsJson?.features)
      ? depositsJson.features
      : [];
    const occurrences = Array.isArray(occurrencesJson?.features)
      ? occurrencesJson.features
      : [];
    const faults = Array.isArray(faultsJson?.features)
      ? faultsJson.features
      : [];
    const lineaments = Array.isArray(lineamentsJson?.features)
      ? lineamentsJson.features
      : [];
    const alluvial = Array.isArray(alluvialJson?.features)
      ? alluvialJson.features
      : [];
    const geology = Array.isArray(geologyJson?.features)
      ? geologyJson.features
      : [];
    const drainageSimple = Array.isArray(drainageSimpleJson?.features)
      ? drainageSimpleJson.features
      : [];
    const drainageDouble = Array.isArray(drainageDoubleJson?.features)
      ? drainageDoubleJson.features
      : [];

    const mineralFeatures = [...deposits, ...occurrences];
    const mineralValues = points.map(
      (point) =>
        weightedDistanceValue(point, mineralFeatures, radiusKm, {
          commodity,
        }).value,
    );
    const faultValues = points.map(
      (point) => lineDistanceValue(point, faults, radiusKm * 0.8).value,
    );
    const lineamentValues = points.map(
      (point) =>
        lineDistanceValue(
          point,
          lineaments,
          radiusKm * 0.85,
          null,
          lineamentWeight,
        ).value,
    );
    const structureValues = points.map((_, index) =>
      Math.min(1, faultValues[index] * 0.7 + lineamentValues[index] * 0.3),
    );
    const alluvialValues = points.map(
      (point) =>
        lineDistanceValue(
          point,
          alluvial,
          radiusKm * 0.9,
          commodity === 'gold' ? 'gold' : null,
        ).value,
    );
    const geologyValues = [];
    const matchedUnits = [];
    for (const point of points) {
      const result = geologyValue(point, geology, commodity);
      geologyValues.push(result.value);
      matchedUnits.push(result.matchedUnit);
    }

    const drainageValues = points.map((point) =>
      drainageValue(point, drainageSimple, drainageDouble, radiusKm),
    );

    const geochemistrySamples = await mapConcurrent(
      points.filter(validPoint),
      geochemistryConcurrency,
      (point) =>
        identifyGeochemistry(
          point,
          radiusKm,
          geochemistryUrl,
          fetchImpl,
          signal,
        ),
    );
    const geoSampleById = new Map(
      points
        .filter(validPoint)
        .map((point, index) => [
          point.id ?? `__${index}`,
          geochemistrySamples[index],
        ]),
    );
    const rawAu = points.map((point, index) => {
      const row = geoSampleById.get(point.id ?? `__${index}`);
      return finite(row?.au);
    });
    const rawAg = points.map((point, index) => {
      const row = geoSampleById.get(point.id ?? `__${index}`);
      return finite(row?.ag);
    });
    const rawCu = points.map((point, index) => {
      const row = geoSampleById.get(point.id ?? `__${index}`);
      return finite(row?.cu);
    });
    const auAnomalyValues = positiveAnomaly(rawAu);
    const agAnomalyValues = positiveAnomaly(rawAg);
    const cuAnomalyValues = positiveAnomaly(rawCu);
    const geochemistryValues = points.map((_, index) =>
      geochemistryComposite(
        commodity,
        auAnomalyValues[index],
        agAnomalyValues[index],
        cuAnomalyValues[index],
      ),
    );

    const sourceParts = [];
    if (deposits.length || occurrences.length) sourceParts.push('metalogénico');
    if (faults.length) sourceParts.push('fallas');
    if (lineaments.length) sourceParts.push('lineamientos');
    if (alluvial.length) sourceParts.push('aluvial');
    if (geology.length) sourceParts.push('geología');
    if (drainageSimple.length || drainageDouble.length)
      sourceParts.push('drenaje');
    if (
      geochemistrySamples.some(
        (sample) => sample && Object.values(sample).some(Number.isFinite),
      )
    )
      sourceParts.push('geoquímica Au/Ag/Cu');

    const geochemistrySampleCount = geochemistrySamples.filter(
      (sample) => sample && Object.values(sample).some(Number.isFinite),
    ).length;

    return {
      values: geologyValues,
      geologyValues,
      structureValues,
      mineralizationValues: mineralValues,
      alluvialValues,
      lineamentValues,
      drainageValues,
      geochemistryValues,
      auAnomalyValues,
      agAnomalyValues,
      cuAnomalyValues,
      rawGeochemistry: {
        au: rawAu,
        ag: rawAg,
        cu: rawCu,
      },
      source: sourceParts.length
        ? `SGC 2016/2020/2022/2023 · ${sourceParts.join(' + ')}`
        : null,
      featureCount: mineralFeatures.length,
      faultFeatureCount: faults.length,
      lineamentFeatureCount: lineaments.length,
      alluvialFeatureCount: alluvial.length,
      geologyMapFeatureCount: geology.length,
      drainageSimpleFeatureCount: drainageSimple.length,
      drainageDoubleFeatureCount: drainageDouble.length,
      geochemistrySampleCount,
      geochemistrySource:
        geochemistrySampleCount > 0
          ? 'SGC Atlas Geoquímico 2020 · Au/Ag/Cu'
          : null,
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
  lineaments: DEFAULT_LINEAMENTS_URL,
  alluvial: DEFAULT_ALLUVIAL_URL,
  geologyMap: DEFAULT_GEOLOGY_URL,
  drainageSimple: DEFAULT_DRAINAGE_SIMPLE_URL,
  drainageDouble: DEFAULT_DRAINAGE_DOUBLE_URL,
  geochemistry: DEFAULT_GEOCHEMISTRY_URL,
});
