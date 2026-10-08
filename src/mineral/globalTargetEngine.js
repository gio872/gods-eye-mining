/**
 * GEM Global Target Engine.
 *
 * Deterministic and auditable. With only public occurrence/reference data
 * available, this produces a reference-prospectivity score, never a
 * fabricated discovery probability.
 */

export const TARGET_MODEL_ID = 'GEM-GLOBAL-REFERENCE-01';

const CRITICAL_KEYWORDS = Object.freeze([
  'lithium',
  'cobalt',
  'nickel',
  'rare earth',
  'ree',
  'graphite',
  'tungsten',
  'tin',
  'niobium',
  'tantalum',
  'vanadium',
  'platinum',
  'palladium',
  'iridium',
  'rhodium',
  'chromium',
  'manganese',
  'copper',
  'uranium',
  'phosphate',
  'potash',
  'antimony',
  'bismuth',
  'beryllium',
  'gallium',
  'germanium',
  'indium',
  'tellurium',
]);

const PRODUCER_TERMS = Object.freeze([
  'producer',
  'past producer',
  'mine',
  'operating',
  'active',
  'producing',
]);

const DEFAULT_WEIGHTS = Object.freeze({
  occurrenceDensity: 0.34,
  commodityDiversity: 0.18,
  criticalMineralEvidence: 0.18,
  developmentEvidence: 0.10,
  multisourceConvergence: 0.20,
});

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function normalizedText() {
  return Array.from(arguments)
    .filter((value) => value != null)
    .map((value) => String(value).toLowerCase())
    .join(' ');
}

function uniqueCommodityTokens(feature) {
  const p = feature && feature.properties ? feature.properties : {};
  const raw = p.raw && typeof p.raw === 'object' ? p.raw : {};
  const sourceText = normalizedText(
    p.mineral,
    p.depositType,
    p.location,
    raw.code_list,
    raw.commodity,
  );
  const tokens = new Set();
  for (const term of CRITICAL_KEYWORDS) {
    if (sourceText.includes(term)) tokens.add(term);
  }
  return tokens;
}

function producerEvidence(feature) {
  const p = feature && feature.properties ? feature.properties : {};
  const raw = p.raw && typeof p.raw === 'object' ? p.raw : {};
  const text = normalizedText(p.status, p.grade, raw.dev_stat);
  if (!text) return 0;
  return PRODUCER_TERMS.some((term) => text.includes(term)) ? 1 : 0;
}

function cellKey(lon, lat, size) {
  const x = Math.floor((lon + 180) / size);
  const y = Math.floor((lat + 90) / size);
  return String(x) + ':' + String(y);
}

function cellCenter(key, size) {
  const parts = key.split(':').map(Number);
  return {
    longitude: -180 + (parts[0] + 0.5) * size,
    latitude: -90 + (parts[1] + 0.5) * size,
  };
}

function neighborKeys(x, y) {
  const keys = [];
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      keys.push(String(x + dx) + ':' + String(y + dy));
    }
  }
  return keys;
}

function autoCellSize(bbox) {
  const spanLon = Math.abs(bbox.east - bbox.west);
  const spanLat = Math.abs(bbox.north - bbox.south);
  const span = Math.max(spanLon, spanLat);
  if (span > 120) return 2;
  if (span > 60) return 1;
  if (span > 25) return 0.5;
  if (span > 10) return 0.25;
  if (span > 3) return 0.1;
  return 0.05;
}

function targetTier(score) {
  if (score >= 85) return 'TIER 1';
  if (score >= 70) return 'TIER 2';
  if (score >= 55) return 'TIER 3';
  return 'TIER 4';
}

function scoreCell(bucket, neighborCount, sourceCount, weights) {
  const count = bucket.features.length;
  const density = clamp(count / 6);
  const commodityCount = new Set(
    bucket.features.flatMap(uniqueCommodityTokens),
  ).size;
  const diversity = clamp(commodityCount / 4);
  const critical = clamp(bucket.critical / Math.max(1, count));
  const development = bucket.producers / Math.max(1, count);
  const convergence = clamp(sourceCount / 2) * 0.7 + clamp(neighborCount / 6) * 0.3;

  const raw =
    density * weights.occurrenceDensity +
    diversity * weights.commodityDiversity +
    critical * weights.criticalMineralEvidence +
    development * weights.developmentEvidence +
    convergence * weights.multisourceConvergence;

  return {
    score: Math.round(clamp(raw) * 1000) / 10,
    components: {
      occurrenceDensity: Math.round(density * 100),
      commodityDiversity: Math.round(diversity * 100),
      criticalMineralEvidence: Math.round(critical * 100),
      developmentEvidence: Math.round(development * 100),
      multisourceConvergence: Math.round(convergence * 100),
    },
  };
}

export function generateGlobalTargets(
  features,
  bbox,
  {
    cellSize = autoCellSize(bbox),
    topN = 32,
    weights = DEFAULT_WEIGHTS,
  } = {},
) {
  if (!Array.isArray(features))
    throw new TypeError('features must be an array');
  if (!bbox || typeof bbox !== 'object')
    throw new TypeError('bbox is required');

  const cells = new Map();

  for (const feature of features) {
    const coordinates =
      feature &&
      feature.geometry &&
      Array.isArray(feature.geometry.coordinates)
        ? feature.geometry.coordinates
        : [];
    const longitude = Number(coordinates[0]);
    const latitude = Number(coordinates[1]);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude))
      continue;
    if (
      longitude < bbox.west ||
      longitude > bbox.east ||
      latitude < bbox.south ||
      latitude > bbox.north
    )
      continue;

    const key = cellKey(longitude, latitude, cellSize);
    let bucket = cells.get(key);
    if (!bucket) {
      bucket = {
        features: [],
        sources: new Set(),
        critical: 0,
        producers: 0,
      };
      cells.set(key, bucket);
    }

    bucket.features.push(feature);
    bucket.sources.add(
      feature.properties && feature.properties.sourceId,
    );
    if (
      feature.properties &&
      feature.properties.sourceId === 'usgs-critical-minerals'
    )
      bucket.critical += 1;
    bucket.producers += producerEvidence(feature);
  }

  const targets = [];

  for (const entry of cells) {
    const key = entry[0];
    const bucket = entry[1];
    const parts = key.split(':').map(Number);
    const neighbors = neighborKeys(parts[0], parts[1])
      .filter((neighbor) => neighbor !== key)
      .reduce(
        (sum, neighbor) =>
          sum + (cells.get(neighbor) ? cells.get(neighbor).features.length : 0),
        0,
      );
    const center = cellCenter(key, cellSize);
    const scored = scoreCell(
      bucket,
      neighbors,
      bucket.sources.size,
      weights,
    );

    let nearest = null;
    for (const feature of bucket.features) {
      const coords = feature.geometry.coordinates;
      const featureCenter = {
        longitude: coords[0],
        latitude: coords[1],
      };
      const distance = distanceKm(center, featureCenter);
      if (!nearest || distance < nearest.distanceKm)
        nearest = { distanceKm: distance, feature };
    }

    const commodities = Array.from(
      new Set(bucket.features.flatMap(uniqueCommodityTokens)),
    ).slice(0, 6);

    targets.push({
      id: 'GEM-TGT-' + String(targets.length + 1).padStart(5, '0'),
      modelId: TARGET_MODEL_ID,
      latitude: center.latitude,
      longitude: center.longitude,
      score: scored.score,
      tier: targetTier(scored.score),
      evidence: scored.components,
      sourceCount: bucket.sources.size,
      referenceCount: bucket.features.length,
      commodities: commodities,
      nearestReferenceKm:
        Math.round((nearest ? nearest.distanceKm : 0) * 10) / 10,
      nearestReference:
        nearest && nearest.feature && nearest.feature.properties
          ? nearest.feature.properties.name || null
          : null,
      interpretation:
        'Reference-data prospectivity zone generated from documented mineral evidence; requires geological, geophysical, geochemical and field validation.',
    });
  }

  return targets
    .sort((a, b) => b.score - a.score || b.referenceCount - a.referenceCount)
    .slice(0, topN)
    .map((target, index) => ({ ...target, rank: index + 1 }));
}

export function buildEvidenceSummary(features, targets) {
  const bySource = new Map();
  for (const feature of features || []) {
    const id =
      feature &&
      feature.properties &&
      feature.properties.sourceId
        ? feature.properties.sourceId
        : 'unknown';
    bySource.set(id, (bySource.get(id) || 0) + 1);
  }

  const scores = (targets || []).map((target) => target.score);

  return {
    referenceFeatures: features ? features.length : 0,
    sourceCounts: Object.fromEntries(bySource),
    targetCount: targets ? targets.length : 0,
    tier1: (targets || []).filter((target) => target.tier === 'TIER 1').length,
    tier2: (targets || []).filter((target) => target.tier === 'TIER 2').length,
    topScore: scores.length ? Math.max(...scores) : 0,
    modelId: TARGET_MODEL_ID,
    evidenceState: features && features.length
      ? 'REFERENCE_DATA_ACTIVE'
      : 'NO_REFERENCE_DATA',
  };
}

export function distanceKm(a, b) {
  const radiusKm = 6371.0088;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return (
    2 *
    radiusKm *
    Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))))
  );
}
