import {
  clamp,
  PROSPECTIVITY_FACTORS,
  normalizeFactorMap,
} from './core/miningTypes.js';
import { searchHls } from '../layers/recentImagery/catalog.js';

const WATER_TAGS = new Set([
  'water',
  'waterway',
  'reservoir',
  'river',
  'stream',
  'canal',
  'drain',
  'ditch',
  'lake',
  'pond',
]);

function finite(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function pointOf(value) {
  if (!value || typeof value !== 'object') return null;
  const lat =
    finite(value.lat) ??
    finite(value.latitude) ??
    finite(value.geometry?.coordinates?.[1]) ??
    finite(value.center?.lat);
  const lon =
    finite(value.lon) ??
    finite(value.lng) ??
    finite(value.longitude) ??
    finite(value.geometry?.coordinates?.[0]) ??
    finite(value.center?.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

function nestedPoints(value, output = []) {
  if (!value) return output;
  const direct = pointOf(value);
  if (direct) output.push(direct);
  const coordinates = value.geometry?.coordinates ?? value.coordinates;
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
      for (const child of coordinates) nestedPoints(child, output);
    }
  }
  if (Array.isArray(value.geometry)) {
    for (const child of value.geometry) nestedPoints(child, output);
  }
  return output;
}

function haversineKm(a, b) {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

function propertiesOf(feature) {
  return feature?.properties && typeof feature.properties === 'object'
    ? feature.properties
    : feature?.tags && typeof feature.tags === 'object'
      ? { tags: feature.tags }
      : feature || {};
}

function tagsOf(feature) {
  const properties = propertiesOf(feature);
  return properties.tags && typeof properties.tags === 'object'
    ? { ...properties.tags, ...properties }
    : properties;
}

function isHydrologyFeature(feature) {
  const tags = tagsOf(feature);
  return Object.entries(tags).some(([key, value]) => {
    if (value == null) return false;
    const normalizedKey = String(key).toLowerCase();
    const normalizedValue = String(value).toLowerCase();
    return (
      WATER_TAGS.has(normalizedKey) ||
      WATER_TAGS.has(normalizedValue) ||
      (normalizedKey === 'natural' && normalizedValue === 'water') ||
      (normalizedKey === 'landuse' && normalizedValue === 'reservoir')
    );
  });
}

function pointInsideRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
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

function featureContainsPoint(feature, point) {
  const geometry = feature?.geometry;
  if (!geometry || !point) return false;
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

function scoreHydrology(point, features, radiusKm) {
  let nearest = Infinity;
  for (const feature of features) {
    if (!isHydrologyFeature(feature)) continue;
    if (featureContainsPoint(feature, point)) return 1;
    for (const candidate of nestedPoints(feature)) {
      if (!Number.isFinite(candidate?.lat) || !Number.isFinite(candidate?.lon))
        continue;
      nearest = Math.min(nearest, haversineKm(point, candidate));
    }
  }
  if (!Number.isFinite(nearest)) return 0;
  return clamp(1 - nearest / radiusKm);
}

function terrainFactors(points, heights, profile) {
  const finiteHeights = heights.filter((value) => Number.isFinite(value));
  const globalRelief =
    finiteHeights.length > 1
      ? Math.max(...finiteHeights) - Math.min(...finiteHeights)
      : 0;
  const grid = new Map();
  for (let index = 0; index < points.length; index += 1) {
    const row = points[index]?.gridRow;
    const col = points[index]?.gridCol;
    if (Number.isInteger(row) && Number.isInteger(col))
      grid.set(`${row}:${col}`, index);
  }

  const values = points.map((point, index) => {
    const row = point?.gridRow;
    const col = point?.gridCol;
    const centre = heights[index];
    if (!Number.isFinite(centre) || !Number.isInteger(row) || !Number.isInteger(col)) {
      return clamp(globalRelief / 300);
    }

    const northIndex = grid.get(`${row - 1}:${col}`);
    const southIndex = grid.get(`${row + 1}:${col}`);
    const westIndex = grid.get(`${row}:${col - 1}`);
    const eastIndex = grid.get(`${row}:${col + 1}`);
    const neighbours = [northIndex, southIndex, westIndex, eastIndex]
      .map((neighbor) => (neighbor == null ? null : heights[neighbor]))
      .filter((value) => Number.isFinite(value));

    const localRelief =
      neighbours.length > 0
        ? Math.max(centre, ...neighbours) - Math.min(centre, ...neighbours)
        : globalRelief;

    let slopeDegrees = 0;
    if (
      Number.isFinite(heights[northIndex]) &&
      Number.isFinite(heights[southIndex]) &&
      Number.isFinite(heights[westIndex]) &&
      Number.isFinite(heights[eastIndex])
    ) {
      const latScale = 111_320;
      const lonScale =
        111_320 * Math.max(0.01, Math.cos((point.lat * Math.PI) / 180));
      const stepLatM = latScale * 0.005;
      const stepLonM = lonScale * 0.005;
      const dzDy =
        (heights[southIndex] - heights[northIndex]) / (2 * stepLatM);
      const dzDx =
        (heights[eastIndex] - heights[westIndex]) / (2 * stepLonM);
      slopeDegrees =
        (Math.atan(Math.hypot(dzDx, dzDy)) * 180) / Math.PI;
    }

    const exposure = clamp(
      clamp(localRelief / 150) * 0.55 + clamp(slopeDegrees / 35) * 0.45,
    );
    const alluvialTerrain = clamp(
      clamp(1 - slopeDegrees / 25) * 0.7 + clamp(localRelief / 100) * 0.3,
    );
    return profile === 'gold-alluvial' ? alluvialTerrain : exposure;
  });

  return {
    values,
    reliefM: globalRelief,
    localReliefM: points.map((point, index) => {
      const row = point?.gridRow;
      const col = point?.gridCol;
      if (!Number.isInteger(row) || !Number.isInteger(col)) return globalRelief;
      const centre = heights[index];
      const neighbors = [
        grid.get(`${row - 1}:${col}`),
        grid.get(`${row + 1}:${col}`),
        grid.get(`${row}:${col - 1}`),
        grid.get(`${row}:${col + 1}`),
      ]
        .filter((neighbor) => neighbor != null)
        .map((neighbor) => heights[neighbor])
        .filter(Number.isFinite);
      return neighbors.length
        ? Math.max(centre, ...neighbors) - Math.min(centre, ...neighbors)
        : globalRelief;
    }),
  };
}

function readNumericEvidence(feature) {
  const properties = propertiesOf(feature);
  for (const key of ['prospectivity', 'evidence', 'score', 'rating', 'rank']) {
    const value = finite(properties[key]);
    if (Number.isFinite(value)) return clamp(value);
    const nested = finite(properties.tags?.[key]);
    if (Number.isFinite(nested)) return clamp(nested);
  }
  return null;
}

function sourceFlag(value) {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Bridge God's Eye runtime data into GEM's normalized evidence contract.
 */
export function createMiningEvidenceBridge({
  terrain,
  featureSource = null,
  geologySource = null,
  imageryLayer = null,
  imagerySource = searchHls,
  getContextLayers = () => [],
  hydrologyRadiusKm = 2,
  signal = null,
} = {}) {
  if (typeof terrain?.resolveEllipsoidalGround !== 'function')
    throw new TypeError('GEM evidence bridge requires terrain resolution');

  async function collectHydrology(points, requestSignal) {
    if (typeof featureSource?.getFootprints !== 'function') {
      return {
        values: points.map(() => 0),
        source: null,
        featureCount: 0,
      };
    }
    const centre = points[Math.floor(points.length / 2)];
    if (!centre) return { values: [], source: null, featureCount: 0 };
    const response = await featureSource.getFootprints(centre, {
      signal: requestSignal,
    });
    const available = Array.isArray(response);
    const features = available ? response : [];
    return {
      values: points.map((point) =>
        scoreHydrology(point, features, hydrologyRadiusKm),
      ),
      source: available ? 'Gods Eye GIS · Overpass' : null,
      featureCount: features.length,
    };
  }

  async function collectGeology(points, requestSignal, commodity) {
    if (
      typeof geologySource?.getEvidence !== 'function' &&
      typeof geologySource?.getFeatures !== 'function'
    ) {
      return {
        values: points.map(() => 0),
        structureValues: points.map(() => 0),
        mineralizationValues: points.map(() => 0),
        alluvialValues: points.map(() => 0),
        source: null,
        geologyAvailable: false,
        structureSource: null,
        mineralizationSource: null,
        alluvialSource: null,
      };
    }
    const centre = points[Math.floor(points.length / 2)];
    const raw =
      typeof geologySource.getEvidence === 'function'
        ? await geologySource.getEvidence({
            points,
            center: centre,
            commodity,
            signal: requestSignal,
          })
        : await geologySource.getFeatures({
            points,
            center: centre,
            commodity,
            signal: requestSignal,
          });

    if (Array.isArray(raw)) {
      const values = points.map(() => {
        let best = 0;
        for (const feature of raw) {
          const evidence = readNumericEvidence(feature);
          if (evidence != null) best = Math.max(best, evidence);
        }
        return best;
      });
      return {
        values,
        structureValues: points.map(() => 0),
        mineralizationValues: values,
        alluvialValues: points.map(() => 0),
        source: raw.length ? 'GEM geology GIS' : null,
        geologyAvailable: raw.length > 0,
        structureSource: null,
        mineralizationSource: raw.length ? 'GEM geology GIS' : null,
        alluvialSource: null,
      };
    }

    return {
      values: points.map(
        (_, index) => clamp(raw?.geologyValues?.[index] ?? raw?.values?.[index]),
      ),
      structureValues: points.map((_, index) =>
        clamp(raw?.structureValues?.[index]),
      ),
      mineralizationValues: points.map((_, index) =>
        clamp(raw?.mineralizationValues?.[index]),
      ),
      alluvialValues: points.map((_, index) =>
        clamp(raw?.alluvialValues?.[index]),
      ),
      source: sourceFlag(raw?.source) ? raw.source : null,
      geologyAvailable:
        Number(raw?.geologyMapFeatureCount) > 0 ||
        Boolean(raw?.geologySource),
      structureSource:
        Number(raw?.faultFeatureCount) > 0 ? raw.source : null,
      mineralizationSource:
        Number(raw?.featureCount) > 0 ? raw.source : null,
      alluvialSource:
        Number(raw?.alluvialFeatureCount) > 0 ? raw.source : null,
      geologyMapFeatureCount: Number(raw?.geologyMapFeatureCount) || 0,
      faultFeatureCount: Number(raw?.faultFeatureCount) || 0,
      mineralizationFeatureCount: Number(raw?.featureCount) || 0,
      alluvialFeatureCount: Number(raw?.alluvialFeatureCount) || 0,
      matchedUnits: Array.isArray(raw?.matchedUnits) ? raw.matchedUnits : [],
    };
  }

  async function collectImagery(points, requestSignal) {
    const stats = imageryLayer?.getStats?.() || {};
    const params = imageryLayer?.getParams?.() || {};
    const layerCount = Number(stats.count);
    const pinned = Boolean(params.a || params.b);
    const centre = points[Math.floor(points.length / 2)];
    let candidates = [];
    let catalogError = null;
    if (centre && typeof imagerySource === 'function') {
      try {
        const delta = 0.02;
        const result = await imagerySource({
          box: {
            west: Math.max(-180, centre.lon - delta),
            south: Math.max(-90, centre.lat - delta),
            east: Math.min(180, centre.lon + delta),
            north: Math.min(90, centre.lat + delta),
          },
          days: 30,
          signal: requestSignal,
        });
        candidates = Array.isArray(result?.candidates) ? result.candidates : [];
        catalogError = result?.errors?.length ? result.errors : null;
      } catch (error) {
        catalogError = [String(error?.message || error)];
      }
    }
    const count =
      candidates.length || (Number.isFinite(layerCount) ? layerCount : 0);
    const lowCloud = candidates.filter(
      (candidate) =>
        !Number.isFinite(Number(candidate?.cloud)) ||
        Number(candidate.cloud) <= 30,
    ).length;
    const value = clamp(count / 20 + lowCloud / 40 + (pinned ? 0.15 : 0));
    return {
      value,
      source: count > 0 || pinned ? 'NASA HLS · Gods Eye imagery' : null,
      candidateCount: count,
      lowCloudCount: lowCloud,
      pinned,
      catalogError,
    };
  }

  function existingLayerContext(points) {
    const context = {};
    const centre = points[Math.floor(points.length / 2)];
    for (const layer of getContextLayers() || []) {
      if (!layer || layer.id === 'gem-prospectivity') continue;
      if (typeof layer.getAnalystRecords !== 'function') continue;
      try {
        const rows = layer.getAnalystRecords();
        if (!Array.isArray(rows) || rows.length === 0) continue;
        let nearby = 0;
        for (const row of rows) {
          const point = pointOf(row);
          if (point && centre && haversineKm(centre, point) <= 5) nearby += 1;
        }
        if (nearby) context[layer.id] = nearby;
      } catch {
        // One layer must not break GEM context collection.
      }
    }
    return context;
  }

  async function buildEvidence(points, options = {}) {
    const requestSignal =
      signal && options.signal
        ? AbortSignal.any([signal, options.signal])
        : options.signal || signal;
    requestSignal?.throwIfAborted();
    if (!Array.isArray(points) || points.length === 0) return [];

    const terrainResults = await terrain.resolveEllipsoidalGround(points, {
      signal: requestSignal,
    });
    const heights = terrainResults.map((row) => row?.ellipsoid);
    const terrainResult = terrainFactors(
      points,
      heights,
      options.profile || 'base',
    );
    const [hydrologyResult, geologyResult] = await Promise.all([
      collectHydrology(points, requestSignal),
      collectGeology(points, requestSignal, options.commodity || 'gold'),
    ]);
    const imagery = await collectImagery(points, requestSignal);
    const context = existingLayerContext(points);

    return points.map((point, index) => {
      const factors = normalizeFactorMap({
        terrain: terrainResult.values[index],
        hydrology: hydrologyResult.values[index] ?? 0,
        geology: geologyResult.values[index] ?? 0,
        structure: geologyResult.structureValues?.[index] ?? 0,
        mineralization: geologyResult.mineralizationValues?.[index] ?? 0,
        'remote-sensing': imagery.value,
        alluvial: geologyResult.alluvialValues?.[index] ?? 0,
        sampling: 0,
      });

      const covered = [
        Boolean(terrainResults[index]?.source),
        Boolean(hydrologyResult.source),
        Boolean(geologyResult.geologyAvailable),
        Boolean(geologyResult.structureSource),
        Boolean(geologyResult.mineralizationSource),
        Boolean(imagery.source),
        Boolean(geologyResult.alluvialSource),
      ];
      const applicability = 7;

      return {
        ...point,
        factors,
        metadata: {
          terrainHeightM: finite(heights[index]),
          terrainReliefM: terrainResult.reliefM,
          localReliefM: terrainResult.localReliefM[index],
          terrainSource: terrainResults[index]?.source || null,
          hydrologySource: hydrologyResult.source,
          hydrologyFeatureCount: hydrologyResult.featureCount,
          geologySource: geologyResult.source,
          geologyAvailable: geologyResult.geologyAvailable,
          geologyMapFeatureCount: geologyResult.geologyMapFeatureCount || 0,
          structureSource: geologyResult.structureSource,
          faultFeatureCount: geologyResult.faultFeatureCount || 0,
          mineralizationSource: geologyResult.mineralizationSource,
          mineralizationFeatureCount: geologyResult.mineralizationFeatureCount || 0,
          alluvialSource: geologyResult.alluvialSource,
          alluvialFeatureCount: geologyResult.alluvialFeatureCount || 0,
          matchedGeologyUnit: geologyResult.matchedUnits?.[index] || null,
          imagerySource: imagery.source,
          imageryCandidateCount: imagery.candidateCount,
          imageryLowCloudCount: imagery.lowCloudCount,
          imageryPinned: imagery.pinned,
          imageryCatalogError: imagery.catalogError,
          godEyeLayerContext: context,
          evidenceCoverage: covered.filter(Boolean).length / applicability,
          factorsCovered: PROSPECTIVITY_FACTORS.filter((factor) => {
            const indexByFactor = {
              terrain: 0,
              hydrology: 1,
              geology: 2,
              structure: 3,
              mineralization: 4,
              'remote-sensing': 5,
              alluvial: 6,
            };
            return Boolean(covered[indexByFactor[factor]]);
          }),
        },
      };
    });
  }

  return Object.freeze({ buildEvidence });
}
