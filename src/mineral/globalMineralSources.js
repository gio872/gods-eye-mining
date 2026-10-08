/**
 * GEM Global Mineral Intelligence — source registry and public geospatial adapters.
 *
 * The registry separates live queryable datasets from discovery networks and
 * statistical context sources. Provenance and data limitations travel with
 * every record so downstream targeting can be audited.
 */

export const GLOBAL_MINERAL_SOURCES = Object.freeze({
  mrds: Object.freeze({
    id: 'usgs-mrds',
    name: 'USGS Mineral Resources Data System (MRDS)',
    type: 'occurrence',
    format: 'ArcGIS FeatureServer / GeoJSON',
    endpoint:
      'https://energy.usgs.gov/arcgis/rest/services/Hosted/Mineral_Resource_Data_System/FeatureServer/0/query',
    attribution: 'U.S. Geological Survey (USGS) — MRDS',
    globalCoverage: true,
    maxViewportRecords: 1200,
    queryFields: ['objectid_1', 'dep_id', 'site_name', 'dev_stat', 'code_list', 'grade'],
    limitation:
      'Worldwide coverage is incomplete outside the United States; operational, ownership, production, reserve and resource fields may be historical.',
    licenseHint: 'USGS data/public-data terms apply; preserve source attribution.',
  }),
  criticalMinerals: Object.freeze({
    id: 'usgs-critical-minerals',
    name: 'USGS Global Distribution of Selected Critical Minerals',
    type: 'critical-mineral-occurrence',
    format: 'ArcGIS FeatureServer / GeoJSON',
    endpoint:
      'https://energy.usgs.gov/arcgis/rest/services/Hosted/Global_distribution_of_selected_critical_minerals/FeatureServer/2/query',
    attribution:
      'U.S. Geological Survey (USGS) — Global Distribution of Selected Critical Minerals',
    globalCoverage: true,
    maxViewportRecords: 1600,
    queryFields: ['mineral', 'dep_type', 'latitude', 'longitude', 'location'],
    limitation:
      'Reference compilation of documented deposits/occurrences; not an exhaustive global inventory and not a deposit-probability surface.',
    licenseHint: 'USGS data/public-data terms apply; preserve source attribution.',
  }),
  oneGeology: Object.freeze({
    id: 'onegeology',
    name: 'OneGeology global geological service network',
    type: 'catalogue-network',
    format: 'OGC WMS / WFS / WCS / CSW',
    portal: 'https://onegeology.org/',
    countryStatus:
      'https://onegeology.org/participants/app/1gCountries.cfc?method=viewCountryStatus&servicesOnline=true',
    attribution: 'OneGeology and participating national geological surveys',
    globalCoverage: true,
    discoveryOnly: true,
    limitation:
      'Service availability, licensing and commercial-use conditions vary by provider and layer.',
  }),
  worldMiningData: Object.freeze({
    id: 'world-mining-data',
    name: 'World Mining Data',
    type: 'production-statistics',
    format: 'Official statistics portal',
    portal:
      'https://www.bmf.gv.at/en/topics/mining/mineral-resources-policy/wmd.html',
    globalCoverage: true,
    discoveryOnly: true,
    limitation:
      'Production statistics provide market context, not geologic evidence for a target.',
  }),
  usgsCommoditySummaries: Object.freeze({
    id: 'usgs-mcs',
    name: 'USGS Mineral Commodity Summaries',
    type: 'production-statistics',
    format: 'Official statistics portal',
    portal:
      'https://www.usgs.gov/centers/national-minerals-information-center/mineral-commodity-summaries',
    globalCoverage: true,
    discoveryOnly: true,
    limitation:
      'Commodity-level production/reserve context; values must not be interpreted as spatial prospectivity.',
  }),
});

const DEFAULT_QUERY_FIELDS = Object.freeze([
  'objectid_1',
  'objectid',
  'gid',
  'dep_id',
  'site_name',
  'dev_stat',
  'code_list',
  'grade',
  'mineral',
  'dep_type',
  'latitude',
  'longitude',
  'location',
  'url',
  'json',
]);

function asFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeBBox(bbox) {
  if (!bbox || typeof bbox !== 'object')
    throw new TypeError('A bounding box is required');
  const west = asFiniteNumber(bbox.west);
  const south = asFiniteNumber(bbox.south);
  const east = asFiniteNumber(bbox.east);
  const north = asFiniteNumber(bbox.north);
  if ([west, south, east, north].some((value) => value == null))
    throw new TypeError('Bounding box coordinates must be finite numbers');
  return {
    west: Math.max(-180, Math.min(180, west)),
    south: Math.max(-90, Math.min(90, south)),
    east: Math.max(-180, Math.min(180, east)),
    north: Math.max(-90, Math.min(90, north)),
  };
}

function bboxGeometry(bbox) {
  return [
    bbox.west,
    bbox.south,
    bbox.east,
    bbox.north,
  ].join(',');
}

function parseGeoJsonPayload(payload) {
  if (!payload || typeof payload !== 'object')
    throw new Error('Mineral source returned a non-object payload');
  if (payload.error) {
    const detail = payload.error.message || (payload.error.details || []).join('; ');
    throw new Error(detail || 'Mineral source returned an ArcGIS error');
  }
  const features = Array.isArray(payload.features) ? payload.features : [];
  return features
    .filter((feature) => feature && feature.geometry && feature.geometry.type === 'Point')
    .map((feature) => ({
      type: 'Feature',
      geometry: feature.geometry,
      properties:
        feature.properties && typeof feature.properties === 'object'
          ? feature.properties
          : {},
    }));
}

export async function fetchArcGISPoints(
  source,
  bbox,
  {
    signal,
    fetchImpl = globalThis.fetch,
    where = '1=1',
    outFields,
    limit,
    maxPages = 1,
  } = {},
) {
  if (!source || !source.endpoint)
    throw new TypeError('A queryable mineral source is required');
  if (typeof fetchImpl !== 'function')
    throw new TypeError('fetch is unavailable');
  const box = normalizeBBox(bbox);
  const url = new URL(source.endpoint);
  url.searchParams.set('where', where);
  url.searchParams.set('geometry', bboxGeometry(box));
  url.searchParams.set('geometryType', 'esriGeometryEnvelope');
  url.searchParams.set('inSR', '4326');
  url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
  const fields = outFields || source.queryFields || DEFAULT_QUERY_FIELDS;
  url.searchParams.set('outFields', fields.join(','));
  url.searchParams.set('returnGeometry', 'true');
  url.searchParams.set('outSR', '4326');
  url.searchParams.set('f', 'geojson');
  url.searchParams.set(
    'resultRecordCount',
    String(Math.max(1, Math.min(2000, limit || source.maxViewportRecords || 1200))),
  );
  url.searchParams.set('returnExceededLimitFeatures', 'true');

  const pageLimit = Math.max(1, Math.min(10, Number(maxPages) || 1));
  const pageSize = Math.max(1, Math.min(2000, limit || source.maxViewportRecords || 1200));
  const features = [];
  for (let page = 0; page < pageLimit; page += 1) {
    const pageUrl = new URL(url);
    pageUrl.searchParams.set('resultRecordCount', String(pageSize));
    pageUrl.searchParams.set('resultOffset', String(page * pageSize));
    const response = await fetchImpl(pageUrl, {
      signal,
      headers: { Accept: 'application/geo+json, application/json' },
    });
    if (!response.ok) {
      throw new Error(
        [source.name, 'HTTP', response.status, response.statusText]
          .filter(Boolean)
          .join(' '),
      );
    }
    const pageFeatures = parseGeoJsonPayload(await response.json());
    features.push(...pageFeatures);
    if (pageFeatures.length < pageSize) break;
  }
  return features;

function normalizeProperties(feature, source) {
  const properties = feature && feature.properties ? feature.properties : {};
  const latitude =
    asFiniteNumber(properties.latitude) ??
    asFiniteNumber(feature && feature.geometry && feature.geometry.coordinates && feature.geometry.coordinates[1]);
  const longitude =
    asFiniteNumber(properties.longitude) ??
    asFiniteNumber(feature && feature.geometry && feature.geometry.coordinates && feature.geometry.coordinates[0]);
  return {
    sourceId: source.id,
    sourceName: source.name,
    latitude,
    longitude,
    name:
      properties.site_name ||
      properties.dep_name ||
      properties.location ||
      properties.dep_id ||
      'Unnamed occurrence',
    status: properties.dev_stat || properties.grade || null,
    mineral:
      properties.mineral ||
      properties.commodity ||
      properties.code_list ||
      properties.code ||
      null,
    depositType:
      properties.dep_type ||
      properties.deposit_type ||
      null,
    grade: properties.grade || null,
    location: properties.location || null,
    url: properties.url || null,
    raw: properties,
  };
}

export function normalizeMineralFeatures(features, source) {
  if (!Array.isArray(features)) return [];
  return features
    .map((feature) => {
      const p = normalizeProperties(feature, source);
      if (!Number.isFinite(p.latitude) || !Number.isFinite(p.longitude))
        return null;
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [p.longitude, p.latitude],
        },
        properties: p,
      };
    })
    .filter(Boolean);
}

export async function queryMineralSources(
  bbox,
  {
    signal,
    fetchImpl = globalThis.fetch,
    where = '1=1',
    sources = [
      GLOBAL_MINERAL_SOURCES.mrds,
      GLOBAL_MINERAL_SOURCES.criticalMinerals,
    ],
    maxPages = 1,
  } = {},
) {
  const jobs = sources
    .filter((source) => source && source.endpoint && !source.discoveryOnly)
    .map(async (source) => {
      const startedAt = Date.now();
      try {
        const raw = await fetchArcGISPoints(source, bbox, {
          fetchImpl,
          signal,
          where,
          maxPages,
        });
        const features = normalizeMineralFeatures(raw, source);
        return {
          source,
          ok: true,
          durationMs: Date.now() - startedAt,
          features,
          count: features.length,
        };
      } catch (error) {
        return {
          source,
          ok: false,
          durationMs: Date.now() - startedAt,
          features: [],
          count: 0,
          error,
        };
      }
    });
  return Promise.all(jobs);
}
