import { clamp, PROSPECTIVITY_FACTORS, normalizeFactorMap } from './core/miningTypes.js';
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
      normalizedKey === 'natural' && normalizedValue === 'water' ||
      normalizedKey === 'landuse' && normalizedValue === 'reservoir'
    );
  });
}

function scoreHydrology(point, features, radiusKm) {
  let nearest = Infinity;
  for (const feature of features) {
    if (!isHydrologyFeature(feature)) continue;
    for (const candidate of nestedPoints(feature)) {
      nearest = Math.min(nearest, haversineKm(point, candidate));
    }
  }
  if (!Number.isFinite(nearest)) return 0;
  return clamp(1 - nearest / radiusKm);
}

function terrainFactors(points, heights) {
  const finiteHeights = heights.filter((value) => Number.isFinite(value));
  const globalRelief =
    finiteHeights.length > 1
      ? Math.max(...finiteHeights) - Math.min(...finiteHeights)
      : 0;
  return {
    values: points.map(() => clamp(globalRelief / 300)),
    reliefM: globalRelief,
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

/**
 * Bridge God's Eye runtime data into GEM's normalized evidence contract.
 * The bridge is intentionally tolerant: absent geology/sampling sources remain
 * explicit null evidence rather than being silently converted into positive data.
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

  async function collectGeology(points, requestSignal) {
    if (
      typeof geologySource?.getEvidence !== 'function' &&
      typeof geologySource?.getFeatures !== 'function'
    ) {
      return {
        values: points.map(() => 0),
        source: null,
        available: false,
      };
    }
    const centre = points[Math.floor(points.length / 2)];
    const raw =
      typeof geologySource.getEvidence === 'function'
        ? await geologySource.getEvidence({
            points,
            center: centre,
            signal: requestSignal,
          })
        : await geologySource.getFeatures({
            points,
            center: centre,
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
        source: 'GEM geology GIS',
        available: true,
        featureCount: raw.length,
      };
    }
    if (Array.isArray(raw?.values)) {
      return {
        values: points.map((_, index) => clamp(raw.values[index])),
        source: raw.source || 'GEM geology GIS',
        available: true,
        featureCount: Number(raw.featureCount) || 0,
      };
    }
    return {
      values: points.map(() => 0),
      source: 'GEM geology GIS',
      available: true,
      featureCount: 0,
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
        // Analyst context is opportunistic; one layer must not break GEM.
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
    const terrainResult = terrainFactors(points, heights);
    const [hydrologyResult, geologyResult] = await Promise.all([
      collectHydrology(points, requestSignal),
      collectGeology(points, requestSignal),
    ]);
    const imagery = await collectImagery(points, requestSignal);
    const context = existingLayerContext(points);

    return points.map((point, index) => {
      const factors = normalizeFactorMap({
        terrain: terrainResult.values[index],
        hydrology: hydrologyResult.values[index] ?? 0,
        geology: geologyResult.values[index] ?? 0,
        'remote-sensing': imagery.value,
        sampling: 0,
      });
      return {
        ...point,
        factors,
        metadata: {
          terrainHeightM: finite(heights[index]),
          terrainReliefM: terrainResult.reliefM,
          terrainSource: terrainResults[index]?.source || null,
          hydrologySource: hydrologyResult.source,
          hydrologyFeatureCount: hydrologyResult.featureCount,
          geologySource: geologyResult.source,
          geologyFeatureCount: geologyResult.featureCount || 0,
          geologyAvailable: geologyResult.available,
          imagerySource: imagery.source,
          imageryCandidateCount: imagery.candidateCount,
          imageryPinned: imagery.pinned,
          imageryLowCloudCount: imagery.lowCloudCount,
          imageryCatalogError: imagery.catalogError,
          godEyeLayerContext: context,
          factorsCovered: PROSPECTIVITY_FACTORS.filter((factor) => {
            if (factor === 'sampling') return false;
            if (factor === 'terrain') return Boolean(terrainResults[index]?.source);
            if (factor === 'hydrology') return Boolean(hydrologyResult.source);
            if (factor === 'geology') return Boolean(geologyResult.source);
            if (factor === 'remote-sensing') return Boolean(imagery.source);
            return false;
          }),
          evidenceCoverage: [
            Boolean(terrainResults[index]?.source),
            Boolean(hydrologyResult.source),
            Boolean(geologyResult.source),
            Boolean(imagery.source),
            false,
          ].filter(Boolean).length / PROSPECTIVITY_FACTORS.length,
        },
      };
    });
  }

  return Object.freeze({ buildEvidence });
}
