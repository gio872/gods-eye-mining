import { fuseEvidence } from './evidenceFusion.js';
/**
 * GEM Global Target Engine.
 *
 * Deterministic and auditable. With only public occurrence/reference data
 * available, this produces a reference-prospectivity score, never a
 * fabricated discovery probability.
 */

export const TARGET_MODEL_ID = 'GEM-GLOBAL-REFERENCE-01';

const CRITICAL_KEYWORDS = Object.freeze([
  'gold',
  'silver',
  'iron',
  'lead',
  'zinc',
  'molybdenum',
  'coal',
  'bauxite',
  'chromite',
  'vanadium',
  'titanium',
  'rare earth',
  'ree',
  'lithium',
  'cobalt',
  'nickel',
  'graphite',
  'tungsten',
  'tin',
  'niobium',
  'tantalum',
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
  developmentEvidence: 0.1,
  multisourceConvergence: 0.2,
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

function adaptiveGridCellSize(bbox, maxCells = 512) {
  const spanLon = Math.max(0.001, Math.abs(bbox.east - bbox.west));
  const spanLat = Math.max(0.001, Math.abs(bbox.north - bbox.south));
  let cellSize = Math.sqrt((spanLon * spanLat) / Math.max(16, maxCells));
  cellSize = Math.max(0.05, cellSize);

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const columns = Math.ceil(spanLon / cellSize);
    const rows = Math.ceil(spanLat / cellSize);
    if (columns * rows <= maxCells) break;
    cellSize *= 1.12;
  }

  return cellSize;
}

function iterateGrid(bbox, cellSize) {
  const cells = [];
  const columns = Math.max(1, Math.ceil((bbox.east - bbox.west) / cellSize));
  const rows = Math.max(1, Math.ceil((bbox.north - bbox.south) / cellSize));

  for (let row = 0; row < rows; row += 1) {
    const latitude = Math.min(bbox.north, bbox.south + (row + 0.5) * cellSize);
    for (let column = 0; column < columns; column += 1) {
      const longitude = Math.min(
        bbox.east,
        bbox.west + (column + 0.5) * cellSize,
      );
      cells.push({
        key: String(column) + ':' + String(row),
        latitude,
        longitude,
      });
    }
  }

  return cells;
}

function buildReferenceSpatialIndex(features, cellSize) {
  const buckets = new Map();

  for (const feature of features) {
    const coordinates =
      feature && feature.geometry && feature.geometry.coordinates;
    if (!Array.isArray(coordinates)) continue;

    const longitude = Number(coordinates[0]);
    const latitude = Number(coordinates[1]);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;

    const key = cellKey(longitude, latitude, cellSize);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }
    bucket.push(feature);
  }

  return buckets;
}

function referenceCellEvidence(features, center, cellSize) {
  const radiusKm = Math.max(10, cellSize * 111.32 * 1.8);
  const sigmaKm = Math.max(8, radiusKm * 0.55);
  let kernel = 0;
  const sources = new Set();
  const nearby = [];

  // Candidates are evaluated against a spatial hash rather than every
  // reference feature. This changes the hot path from O(cells × features)
  // toward O(cells × local_features), which is critical for global scans.
  const buckets = features instanceof Map
    ? features
    : buildReferenceSpatialIndex(features, cellSize);
  const centerCell = cellKey(center.longitude, center.latitude, cellSize);
  const parts = centerCell.split(':').map(Number);
  const radiusCells = Math.max(2, Math.ceil(radiusKm / (cellSize * 111.32)));
  const candidates = [];

  for (let dx = -radiusCells; dx <= radiusCells; dx += 1) {
    for (let dy = -radiusCells; dy <= radiusCells; dy += 1) {
      const bucket = buckets.get(String(parts[0] + dx) + ':' + String(parts[1] + dy));
      if (bucket) candidates.push(...bucket);
    }
  }

  for (const feature of candidates) {
    const coordinates =
      feature && feature.geometry && feature.geometry.coordinates;
    if (!Array.isArray(coordinates)) continue;

    const point = {
      longitude: Number(coordinates[0]),
      latitude: Number(coordinates[1]),
    };
    if (!Number.isFinite(point.longitude) || !Number.isFinite(point.latitude))
      continue;

    const distance = distanceKm(center, point);
    if (distance > radiusKm) continue;

    kernel += Math.exp(-((distance / sigmaKm) ** 2));
    const sourceId =
      feature.properties && feature.properties.sourceId
        ? feature.properties.sourceId
        : 'unknown';
    sources.add(sourceId);
    nearby.push({ feature, distance });
  }

  const density = 1 - Math.exp(-kernel / 2.5);
  const sourceConvergence = Math.min(1, sources.size / 2);
  const score =
    Math.round(clamp(density * 0.72 + sourceConvergence * 0.28) * 1000) / 10;

  nearby.sort((a, b) => a.distance - b.distance);
  const commoditySet = new Set();
  for (const item of nearby.slice(0, 32)) {
    for (const token of uniqueCommodityTokens(item.feature))
      commoditySet.add(token);
  }

  return {
    score,
    referenceCount: nearby.length,
    sourceCount: sources.size,
    nearestReferenceKm: nearby.length
      ? Math.round(nearby[0].distance * 10) / 10
      : null,
    nearestReference:
      nearby.length && nearby[0].feature && nearby[0].feature.properties
        ? nearby[0].feature.properties.name || null
        : null,
    commodities: Array.from(commoditySet).slice(0, 6),
  };
}

export function generateProspectivityCandidates(
  features,
  bbox,
  { cellSize = adaptiveGridCellSize(bbox), maxCells = 512 } = {},
) {
  if (!Array.isArray(features))
    throw new TypeError('features must be an array');
  if (!bbox || typeof bbox !== 'object')
    throw new TypeError('bbox is required');

  let resolvedCellSize = Number(cellSize);
  if (!Number.isFinite(resolvedCellSize) || resolvedCellSize <= 0)
    resolvedCellSize = adaptiveGridCellSize(bbox, maxCells);

  const grid = iterateGrid(bbox, resolvedCellSize);
  const referenceIndex = buildReferenceSpatialIndex(features, resolvedCellSize);

  return grid.map((cell) => {
    const reference = referenceCellEvidence(
      referenceIndex,
      { latitude: cell.latitude, longitude: cell.longitude },
      resolvedCellSize,
    );
    const id =
      'GEM-CAND-' +
      stableTargetToken(
        String(resolvedCellSize) +
          ':' +
          cell.key +
          ':' +
          bbox.west +
          ':' +
          bbox.south,
      );

    return {
      id,
      modelId: TARGET_MODEL_ID,
      latitude: cell.latitude,
      longitude: cell.longitude,
      score: reference.score,
      tier: targetTier(reference.score),
      evidence: {
        occurrenceDensity: Math.round(reference.score),
        commodityDiversity: 0,
        criticalMineralEvidence: 0,
        developmentEvidence: 0,
        multisourceConvergence: Math.round(
          Math.min(1, reference.sourceCount / 2) * 100,
        ),
      },
      sourceCount: reference.sourceCount,
      referenceCount: reference.referenceCount,
      commodities: reference.commodities,
      nearestReferenceKm: reference.nearestReferenceKm,
      nearestReference: reference.nearestReference,
      candidate: true,
      gridCellSize: resolvedCellSize,
      interpretation:
        'Spatial candidate generated independently of known occurrences. Public occurrences are one evidence channel, not a requirement for a candidate.',
    };
  });
}

function targetTier(score) {
  if (score >= 85) return 'TIER 1';
  if (score >= 70) return 'TIER 2';
  if (score >= 55) return 'TIER 3';
  return 'TIER 4';
}

function stableTargetToken(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

function scoreCell(bucket, neighborCount, sourceCount, weights) {
  const count = bucket.features.length;
  const density = clamp(count / 6);
  const commodityTokens = new Set();
  for (const feature of bucket.features) {
    for (const token of uniqueCommodityTokens(feature))
      commodityTokens.add(token);
  }
  const commodityCount = commodityTokens.size;
  const diversity = clamp(commodityCount / 4);
  const critical = clamp(bucket.critical / Math.max(1, count));
  const development = bucket.producers / Math.max(1, count);
  const convergence =
    clamp(sourceCount / 2) * 0.7 + clamp(neighborCount / 6) * 0.3;

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
    evidenceWeights,
    evidenceResolver,
  } = {},
) {
  if (!Array.isArray(features))
    throw new TypeError('features must be an array');
  if (!bbox || typeof bbox !== 'object')
    throw new TypeError('bbox is required');

  const cells = new Map();

  for (const feature of features) {
    const coordinates =
      feature && feature.geometry && Array.isArray(feature.geometry.coordinates)
        ? feature.geometry.coordinates
        : [];
    const longitude = Number(coordinates[0]);
    const latitude = Number(coordinates[1]);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
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
    bucket.sources.add(feature.properties && feature.properties.sourceId);
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
    const scored = scoreCell(bucket, neighbors, bucket.sources.size, weights);
    const rawChannels =
      typeof evidenceResolver === 'function'
        ? evidenceResolver({
            center,
            features: bucket.features,
            referenceComponents: scored.components,
          })
        : {};
    const fusion = fuseEvidence(scored.score, rawChannels, {
      weights: evidenceWeights,
    });

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

    const commoditySet = new Set();
    for (const feature of bucket.features) {
      for (const token of uniqueCommodityTokens(feature))
        commoditySet.add(token);
    }
    const commodities = Array.from(commoditySet).slice(0, 6);

    targets.push({
      id: 'GEM-TGT-' + stableTargetToken(String(cellSize) + ':' + key),
      modelId: TARGET_MODEL_ID,
      latitude: center.latitude,
      longitude: center.longitude,
      score: fusion.score,
      tier: targetTier(fusion.score),
      evidence: scored.components,
      fusion,
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
      feature && feature.properties && feature.properties.sourceId
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
    evidenceState:
      features && features.length
        ? 'REFERENCE_DATA_ACTIVE'
        : 'NO_REFERENCE_DATA',
    evidenceCoverage:
      targets && targets.length
        ? Math.round(
            (targets.reduce(
              (sum, target) =>
                sum +
                Number(
                  target.trueProspectivity &&
                    target.trueProspectivity.coverage != null
                    ? target.trueProspectivity.coverage
                    : target.fusion && target.fusion.coverage != null
                      ? target.fusion.coverage
                      : 0,
                ),
              0,
            ) /
              targets.length) *
              10,
          ) / 10
        : 0,
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
  return 2 * radiusKm * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
}
