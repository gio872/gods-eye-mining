/**
 * GEM — Subsurface Resource Intelligence
 *
 * A provenance-first spatial/depth registry for minerals, metals and petroleum.
 * It stores measured observations and modelled/inferred evidence separately.
 *
 * TRUST RULE:
 * - observed/measured records may report their supplied coordinates/depths.
 * - inferred records are hypotheses and never become resources/reserves by implication.
 * - depth is always expressed relative to an explicit datum/reference.
 */

export const GEM_SUBSURFACE_RESOURCE_VERSION = '1.0.0';

export const RESOURCE_FAMILIES = Object.freeze([
  'MINERAL',
  'METAL',
  'PETROLEUM',
  'NATURAL_GAS',
  'COAL',
  'GEOTHERMAL',
]);

export const EVIDENCE_CLASSES = Object.freeze([
  'MEASURED',
  'OBSERVED',
  'SAMPLED',
  'DRILLED',
  'LOGGED',
  'REMOTE_SENSING',
  'GEOPHYSICAL_INFERENCE',
  'GEOLOGICAL_INFERENCE',
  'MODELLED',
  'HYPOTHESIS',
]);

export const DEPTH_REFERENCE_SYSTEMS = Object.freeze([
  'MSL',       // metres relative to mean sea level
  'GROUND',    // metres below ground surface
  'KB',        // metres below/above Kelly Bushing
  'DF',        // metres below/above drill floor
  'RT',        // metres below/above rotary table
  'SEA_FLOOR', // metres below sea floor
  'UNKNOWN',
]);

const ALIASES = Object.freeze({
  au: 'gold',
  oro: 'gold',
  gold: 'gold',
  ag: 'silver',
  plata: 'silver',
  silver: 'silver',
  cu: 'copper',
  cobre: 'copper',
  copper: 'copper',
  pt: 'platinum',
  platino: 'platinum',
  platinum: 'platinum',
  pd: 'palladium',
  paladio: 'palladium',
  palladium: 'palladium',
  rh: 'rhodium',
  rodio: 'rhodium',
  rhodium: 'rhodium',
  ir: 'iridium',
  iridio: 'iridium',
  iridium: 'iridium',
  w: 'tungsten',
  wolfram: 'tungsten',
  wolframio: 'tungsten',
  tungsten: 'tungsten',
  li: 'lithium',
  litio: 'lithium',
  lithium: 'lithium',
  ni: 'nickel',
  nickel: 'nickel',
  co: 'cobalt',
  cobalt: 'cobalt',
  mn: 'manganese',
  manganese: 'manganese',
  fe: 'iron',
  iron: 'iron',
  hierro: 'iron',
  cr: 'chromium',
  chromium: 'chromium',
  zn: 'zinc',
  zinc: 'zinc',
  pb: 'lead',
  lead: 'lead',
  plomo: 'lead',
  sn: 'tin',
  tin: 'tin',
  nb: 'niobium',
  niobium: 'niobium',
  ta: 'tantalum',
  tantalum: 'tantalum',
  graphite: 'graphite',
  grafito: 'graphite',
  uranium: 'uranium',
  uranio: 'uranium',
  rareearth: 'rare_earths',
  'rare earth': 'rare_earths',
  'rare earths': 'rare_earths',
  ree: 'rare_earths',
  petroleum: 'petroleum',
  oil: 'petroleum',
  crude: 'petroleum',
  'crude oil': 'petroleum',
  petroleo: 'petroleum',
  petróleo: 'petroleum',
  naturalgas: 'natural_gas',
  'natural gas': 'natural_gas',
  gas: 'natural_gas',
});

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function text(value) {
  return value == null ? '' : String(value).trim();
}

export function normalizeCommodity(value) {
  const key = text(value).toLowerCase();
  return ALIASES[key] || key.replace(/\\s+/g, '_');
}

export function normalizeCoordinates(latitude, longitude) {
  const lat = finite(latitude);
  const lon = finite(longitude);
  if (lat == null || lon == null || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return null;
  }
  return Object.freeze({ latitude: lat, longitude: lon });
}

export function normalizeDepthInterval({
  topDepth,
  bottomDepth,
  depth,
  depthDatum = 'UNKNOWN',
  depthUnit = 'm',
  depthType = 'TRUE_VERTICAL_DEPTH',
} = {}) {
  const top = finite(topDepth ?? depth);
  const bottom = finite(bottomDepth ?? depth);
  if (top == null && bottom == null) return null;
  const a = top ?? bottom;
  const b = bottom ?? top;
  if (a == null || b == null) return null;
  const topM = Math.min(a, b);
  const bottomM = Math.max(a, b);
  return Object.freeze({
    top: topM,
    bottom: bottomM,
    midpoint: (topM + bottomM) / 2,
    thickness: Math.max(0, bottomM - topM),
    unit: text(depthUnit) || 'm',
    datum: DEPTH_REFERENCE_SYSTEMS.includes(depthDatum) ? depthDatum : 'UNKNOWN',
    type: text(depthType) || 'TRUE_VERTICAL_DEPTH',
  });
}

export function evidenceClassFromRecord(record = {}) {
  if (record.evidenceClass && EVIDENCE_CLASSES.includes(record.evidenceClass)) {
    return record.evidenceClass;
  }
  if (record.drillholeId || record.wellId) return 'DRILLED';
  if (record.sampleId) return 'SAMPLED';
  if (record.remoteSensing || record.sensor) return 'REMOTE_SENSING';
  return 'OBSERVED';
}

function sourceRef(source = {}) {
  return Object.freeze({
    id: text(source.id || source.sourceId) || null,
    name: text(source.name || source.sourceName) || null,
    url: text(source.url) || null,
    version: text(source.version) || null,
    retrievedAt: text(source.retrievedAt) || null,
    license: text(source.license) || null,
  });
}

export function createSubsurfaceResourceRecord(input = {}) {
  const coordinates = normalizeCoordinates(input.latitude, input.longitude);
  if (!coordinates) throw new Error('Valid latitude/longitude are required');

  const commodity = normalizeCommodity(input.commodity || input.mineral || input.metal || input.resource);
  if (!commodity) throw new Error('Commodity/resource is required');

  const depth = normalizeDepthInterval({
    topDepth: input.topDepth,
    bottomDepth: input.bottomDepth,
    depth: input.depth,
    depthDatum: input.depthDatum,
    depthUnit: input.depthUnit,
    depthType: input.depthType,
  });

  const family = text(input.family).toUpperCase() ||
    (commodity === 'petroleum' ? 'PETROLEUM' : commodity === 'natural_gas' ? 'NATURAL_GAS' : 'MINERAL');

  const evidenceClass = evidenceClassFromRecord(input);
  const id = text(input.id) ||
    'gem-res-' + Math.abs(
      Math.round(
        coordinates.latitude * 100000 +
        coordinates.longitude * 100000 +
        (depth?.midpoint || 0) * 10,
      ),
    ).toString(36);

  return Object.freeze({
    id,
    version: GEM_SUBSURFACE_RESOURCE_VERSION,
    family: RESOURCE_FAMILIES.includes(family) ? family : 'MINERAL',
    commodity,
    commodityLabel: text(input.commodityLabel || input.mineral || input.metal || input.resource) || commodity,
    coordinates,
    elevationM: finite(input.elevationM),
    depth,
    concentration: finite(input.concentration),
    concentrationUnit: text(input.concentrationUnit) || null,
    grade: finite(input.grade),
    gradeUnit: text(input.gradeUnit) || null,
    thicknessM: finite(input.thicknessM) ?? depth?.thickness ?? null,
    drillholeId: text(input.drillholeId) || null,
    wellId: text(input.wellId) || null,
    sampleId: text(input.sampleId) || null,
    observationDate: text(input.observationDate) || null,
    evidenceClass,
    confidence: Math.max(0, Math.min(100, finite(input.confidence) ?? (evidenceClass === 'HYPOTHESIS' ? 20 : 70))),
    positionalAccuracyM: finite(input.positionalAccuracyM),
    depthAccuracyM: finite(input.depthAccuracyM),
    source: sourceRef(input.source || input.provenance),
    notes: text(input.notes) || null,
    tags: Array.isArray(input.tags) ? input.tags.map(text).filter(Boolean) : [],
    status: text(input.status) || 'ACTIVE',
  });
}

function haversineKm(a, b) {
  const R = 6371.0088;
  const p1 = (a.latitude * Math.PI) / 180;
  const p2 = (b.latitude * Math.PI) / 180;
  const dp = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dl = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function depthDistance(a, b) {
  if (!a || !b) return null;
  return Math.abs(a.midpoint - b.midpoint);
}

export function buildSubsurfaceResourceIndex(records = []) {
  const normalized = [];
  for (const record of records) {
    try {
      normalized.push(
        record && record.version === GEM_SUBSURFACE_RESOURCE_VERSION
          ? record
          : createSubsurfaceResourceRecord(record),
      );
    } catch {
      // Invalid records are rejected rather than silently entering the atlas.
    }
  }

  const byCommodity = new Map();
  const byFamily = new Map();
  for (const record of normalized) {
    if (!byCommodity.has(record.commodity)) byCommodity.set(record.commodity, []);
    byCommodity.get(record.commodity).push(record);
    if (!byFamily.has(record.family)) byFamily.set(record.family, []);
    byFamily.get(record.family).push(record);
  }

  return Object.freeze({
    records: Object.freeze(normalized),
    byCommodity,
    byFamily,
    createdAt: new Date().toISOString(),
    version: GEM_SUBSURFACE_RESOURCE_VERSION,
  });
}

export function querySubsurfaceResources(
  index,
  {
    latitude,
    longitude,
    radiusKm = 25,
    commodity,
    family,
    minDepth,
    maxDepth,
    evidenceClasses,
    minConfidence = 0,
    limit = 250,
  } = {},
) {
  const center = normalizeCoordinates(latitude, longitude);
  if (!center) throw new Error('Valid query latitude/longitude are required');

  const candidates = commodity
    ? (index.byCommodity.get(normalizeCommodity(commodity)) || [])
    : family
      ? (index.byFamily.get(String(family).toUpperCase()) || [])
      : index.records;

  const allowedEvidence = Array.isArray(evidenceClasses) ? new Set(evidenceClasses) : null;
  const minD = finite(minDepth);
  const maxD = finite(maxDepth);

  return candidates
    .filter((record) => {
      const distance = haversineKm(center, record.coordinates);
      if (distance > Number(radiusKm)) return false;
      if (record.confidence < Number(minConfidence)) return false;
      if (allowedEvidence && !allowedEvidence.has(record.evidenceClass)) return false;
      const midpoint = record.depth?.midpoint ?? null;
      if (minD != null && (midpoint == null || midpoint < minD)) return false;
      if (maxD != null && (midpoint == null || midpoint > maxD)) return false;
      return true;
    })
    .map((record) => Object.freeze({
      ...record,
      distanceKm: haversineKm(center, record.coordinates),
      depthDistanceM: record.depth ? Math.abs(record.depth.midpoint) : null,
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm || b.confidence - a.confidence)
    .slice(0, Math.max(1, Number(limit) || 250));
}

export function build3DResourceFeatures(records = []) {
  return records
    .filter((record) => record?.coordinates && record?.depth)
    .map((record) => Object.freeze({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [
          record.coordinates.longitude,
          record.coordinates.latitude,
          -record.depth.midpoint,
        ],
      },
      properties: {
        id: record.id,
        commodity: record.commodity,
        family: record.family,
        depthTopM: record.depth.top,
        depthBottomM: record.depth.bottom,
        depthDatum: record.depth.datum,
        depthType: record.depth.type,
        evidenceClass: record.evidenceClass,
        confidence: record.confidence,
        sourceId: record.source.id,
        sourceName: record.source.name,
        positionalAccuracyM: record.positionalAccuracyM,
        depthAccuracyM: record.depthAccuracyM,
        drillholeId: record.drillholeId,
        wellId: record.wellId,
        sampleId: record.sampleId,
        status: record.status,
      },
    }));
}

export function summarizeSubsurfaceResources(records = []) {
  const summary = {
    total: records.length,
    located: 0,
    withDepth: 0,
    drilled: 0,
    measured: 0,
    inferred: 0,
    petroleum: 0,
    naturalGas: 0,
    commodities: {},
    depthRangeM: null,
  };

  let minDepth = Infinity;
  let maxDepth = -Infinity;

  for (const record of records) {
    if (record?.coordinates) summary.located += 1;
    if (record?.depth) {
      summary.withDepth += 1;
      minDepth = Math.min(minDepth, record.depth.top);
      maxDepth = Math.max(maxDepth, record.depth.bottom);
    }
    if (record?.evidenceClass === 'DRILLED') summary.drilled += 1;
    if (record?.evidenceClass === 'MEASURED') summary.measured += 1;
    if (['HYPOTHESIS', 'MODELLED', 'GEOLOGICAL_INFERENCE', 'GEOPHYSICAL_INFERENCE'].includes(record?.evidenceClass)) summary.inferred += 1;
    if (record?.family === 'PETROLEUM') summary.petroleum += 1;
    if (record?.family === 'NATURAL_GAS') summary.naturalGas += 1;
    if (record?.commodity) summary.commodities[record.commodity] = (summary.commodities[record.commodity] || 0) + 1;
  }

  if (Number.isFinite(minDepth)) summary.depthRangeM = { min: minDepth, max: maxDepth };
  return Object.freeze(summary);
}

export function buildResourceEvidence(target, records = [], radiusKm = 10) {
  if (!target) return null;
  const index = Array.isArray(records) ? buildSubsurfaceResourceIndex(records) : records;
  const matches = querySubsurfaceResources(index, {
    latitude: target.latitude,
    longitude: target.longitude,
    radiusKm,
    commodity: target.requestedCommodity || target.commodity,
    limit: 100,
  });

  if (!matches.length) {
    return Object.freeze({
      available: false,
      evidenceClass: 'NONE',
      count: 0,
      coverage: 0,
      confidence: 0,
      records: [],
      interpretation: 'No depth-resolved resource record supplied for this target.',
    });
  }

  const measured = matches.filter((entry) => !['HYPOTHESIS', 'MODELLED', 'GEOLOGICAL_INFERENCE', 'GEOPHYSICAL_INFERENCE'].includes(entry.evidenceClass));
  const confidence = matches.reduce((sum, entry) => sum + entry.confidence, 0) / matches.length;

  return Object.freeze({
    available: true,
    evidenceClass: measured.length ? 'OBSERVED' : 'INFERENCE',
    count: matches.length,
    measuredCount: measured.length,
    coverage: Math.min(100, 30 + matches.length * 10),
    confidence: Math.round(confidence * 10) / 10,
    deepestM: Math.max(...matches.map((entry) => entry.depth?.bottom ?? 0)),
    shallowestM: Math.min(...matches.map((entry) => entry.depth?.top ?? 0)),
    records: matches,
    interpretation: measured.length
      ? 'Depth-resolved resource evidence supplied from observed/measured records; validate reporting standards before resource/reserve classification.'
      : 'Depth-resolved model/inference evidence only; not a mineral resource, reserve, grade or discovery probability.',
  });
}
