import { fuseEvidence } from './evidenceFusion.js';

export const TRUE_PROSPECTIVITY_MODEL_ID = 'GEM-TRUE-MULTISOURCE-01';

export const PROSPECTIVITY_SOURCES = Object.freeze({
  geology: Object.freeze({
    id: 'global-glim-lithology',
    name: 'Global Lithological Map (GLiM v1.1)',
    endpoint:
      'https://services8.arcgis.com/4KhTMTZ1x0f76DSg/arcgis/rest/services/GLiM_Niveau_I/FeatureServer/1/query',
    field: 'xx_Description',
    scaleNote:
      'Global lithology compilation; intended for regional prospectivity context, not deposit-scale mapping.',
  }),
  magnetics: Object.freeze({
    id: 'emag2v3',
    name: 'EMAG2v3 Earth Magnetic Anomaly Grid',
    endpoint:
      'https://gis.ngdc.noaa.gov/arcgis/rest/services/EMAG2v3/ImageServer/getSamples',
    unit: 'nT',
    resolutionArcMinutes: 2,
    scaleNote:
      'Global magnetic anomaly grid compiled from satellite, ship and airborne measurements.',
  }),
  terrain: Object.freeze({
    id: 'world-elevation3d',
    name: 'ArcGIS World Elevation 3D Terrain',
    endpoint:
      'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer/getSamples',
    unit: 'm',
    scaleNote:
      'Global elevation source used only for weak terrain/surface-expression context.',
  }),
});

export const TRUE_PROSPECTIVITY_WEIGHTS = Object.freeze({
  reference: 0.2,
  geology: 0.35,
  geophysics: 0.3,
  structure: 0.15,
});

const LITHOLOGY_PRIORS = Object.freeze({
  gold: Object.freeze({
    'metamorphic rocks': 95,
    metamorphics: 95,
    'intermediate volcanic rocks': 86,
    'basic volcanic rocks': 82,
    'intermediate plutonic rocks': 78,
    'acid plutonic rocks': 72,
    'mixed sedimentary rocks': 74,
    'siliciclastic sedimentary rocks': 68,
    pyroclastics: 62,
  }),
  copper: Object.freeze({
    'intermediate plutonic rocks': 96,
    'acid plutonic rocks': 90,
    'intermediate volcanic rocks': 90,
    'basic volcanic rocks': 82,
    'metamorphic rocks': 62,
    metamorphics: 62,
    pyroclastics: 72,
    'mixed sedimentary rocks': 55,
    'siliciclastic sedimentary rocks': 50,
  }),
  molybdenum: Object.freeze({
    'acid plutonic rocks': 96,
    'intermediate plutonic rocks': 92,
    'intermediate volcanic rocks': 78,
  }),
  tungsten: Object.freeze({
    'acid plutonic rocks': 96,
    'intermediate plutonic rocks': 88,
    metamorphics: 82,
    'metamorphic rocks': 82,
  }),
  lithium: Object.freeze({
    'acid plutonic rocks': 90,
    'siliciclastic sedimentary rocks': 78,
    metamorphics: 72,
    'metamorphic rocks': 72,
  }),
  nickel: Object.freeze({
    'basic plutonic rocks': 98,
    'basic volcanic rocks': 88,
    metamorphics: 62,
    'metamorphic rocks': 62,
  }),
  cobalt: Object.freeze({
    'basic volcanic rocks': 84,
    'basic plutonic rocks': 90,
    metamorphics: 72,
    'metamorphic rocks': 72,
  }),
  platinum: Object.freeze({
    'basic plutonic rocks': 98,
    'basic volcanic rocks': 88,
    metamorphics: 65,
  }),
  palladium: Object.freeze({
    'basic plutonic rocks': 98,
    'basic volcanic rocks': 88,
    metamorphics: 65,
  }),
  iridium: Object.freeze({
    'basic plutonic rocks': 98,
    'basic volcanic rocks': 88,
  }),
  rhodium: Object.freeze({
    'basic plutonic rocks': 98,
    'basic volcanic rocks': 88,
  }),
  manganese: Object.freeze({
    metamorphics: 90,
    'metamorphic rocks': 90,
    'mixed sedimentary rocks': 78,
    'basic volcanic rocks': 82,
  }),
  uranium: Object.freeze({
    'siliciclastic sedimentary rocks': 84,
    'mixed sedimentary rocks': 78,
    'acid plutonic rocks': 72,
    pyroclastics: 76,
  }),
  phosphate: Object.freeze({
    'mixed sedimentary rocks': 92,
    'siliciclastic sedimentary rocks': 88,
  }),
  potash: Object.freeze({
    evaporites: 98,
    'mixed sedimentary rocks': 80,
  }),
  rareearth: Object.freeze({
    'acid plutonic rocks': 92,
    pyroclastics: 70,
    'intermediate plutonic rocks': 75,
  }),
});

const COMMODITY_ALIASES = Object.freeze({
  au: 'gold',
  gold: 'gold',
  copper: 'copper',
  cu: 'copper',
  mo: 'molybdenum',
  molybdenum: 'molybdenum',
  w: 'tungsten',
  tungsten: 'tungsten',
  wolfram: 'tungsten',
  wolframite: 'tungsten',
  lithium: 'lithium',
  li: 'lithium',
  nickel: 'nickel',
  ni: 'nickel',
  cobalt: 'cobalt',
  co: 'cobalt',
  platinum: 'platinum',
  pt: 'platinum',
  palladium: 'palladium',
  pd: 'palladium',
  iridium: 'iridium',
  ir: 'iridium',
  rhodium: 'rhodium',
  rh: 'rhodium',
  manganese: 'manganese',
  mn: 'manganese',
  uranium: 'uranium',
  phosphate: 'phosphate',
  phosphates: 'phosphate',
  potash: 'potash',
  'rare earth': 'rareearth',
  ree: 'rareearth',
});

const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_CONCURRENCY = 8;

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizedText() {
  return Array.from(arguments)
    .filter((value) => value != null)
    .map((value) => String(value).toLowerCase())
    .join(' ');
}

function targetCommodityKeys(target) {
  const text = normalizedText(
    ...(target && target.commodities ? target.commodities : []),
    target && target.nearestReference,
  );
  const keys = [];
  for (const entry of Object.entries(COMMODITY_ALIASES)) {
    if (text.includes(entry[0]) && !keys.includes(entry[1]))
      keys.push(entry[1]);
  }
  return keys;
}

function createTimeoutSignal(signal, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return signal;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort(signal.reason);
  if (signal) signal.addEventListener('abort', onAbort, { once: true });
  controller.signal.addEventListener(
    'abort',
    () => {
      clearTimeout(timeout);
      if (signal) signal.removeEventListener('abort', onAbort);
    },
    { once: true },
  );
  return controller.signal;
}

async function fetchJson(url, { fetchImpl, signal, headers } = {}) {
  const response = await fetchImpl(url, {
    signal,
    headers: {
      Accept: 'application/json',
      ...(headers || {}),
    },
  });
  if (!response.ok)
    throw new Error('HTTP ' + response.status + ' ' + response.statusText);
  return response.json();
}

function pointGeometry(longitude, latitude) {
  return JSON.stringify({
    x: longitude,
    y: latitude,
    spatialReference: { wkid: 4326 },
  });
}

async function queryGlmLithology(target, {
  fetchImpl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal,
} = {}) {
  const longitude = finite(target.longitude);
  const latitude = finite(target.latitude);
  if (longitude == null || latitude == null)
    return { ok: false, channel: 'geology', error: new Error('Invalid target coordinates') };

  const url = new URL(PROSPECTIVITY_SOURCES.geology.endpoint);
  url.searchParams.set('where', '1=1');
  url.searchParams.set('geometry', pointGeometry(longitude, latitude));
  url.searchParams.set('geometryType', 'esriGeometryPoint');
  url.searchParams.set('inSR', '4326');
  url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
  url.searchParams.set('outFields', 'xx_Description,Litho,IDENTITY_');
  url.searchParams.set('returnGeometry', 'false');
  url.searchParams.set('f', 'json');

  try {
    const payload = await fetchJson(url, {
      fetchImpl,
      signal: createTimeoutSignal(signal, timeoutMs),
    });
    const feature = payload.features && payload.features[0];
    const lithology = feature && feature.attributes
      ? feature.attributes.xx_Description ||
        feature.attributes.Litho ||
        feature.attributes.IDENTITY_ ||
        null
      : null;
    return {
      ok: true,
      channel: 'geology',
      lithology,
      score: geologyScore(lithology, target),
      sourceId: PROSPECTIVITY_SOURCES.geology.id,
      sourceName: PROSPECTIVITY_SOURCES.geology.name,
    };
  } catch (error) {
    return {
      ok: false,
      channel: 'geology',
      error,
      sourceId: PROSPECTIVITY_SOURCES.geology.id,
      sourceName: PROSPECTIVITY_SOURCES.geology.name,
    };
  }
}

function parseImageSamples(payload) {
  if (!payload || !Array.isArray(payload.samples)) return [];
  return payload.samples
    .map((sample) => ({
      longitude: finite(
        sample.location && sample.location.x,
      ),
      latitude: finite(
        sample.location && sample.location.y,
      ),
      value: finite(sample.value),
      resolution: finite(sample.resolution),
    }))
    .filter(
      (sample) =>
        sample.longitude != null &&
        sample.latitude != null &&
        sample.value != null,
    );
}

async function sampleImageService(
  source,
  points,
  {
    fetchImpl,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
  } = {},
) {
  const url = new URL(source.endpoint);
  url.searchParams.set(
    'geometry',
    JSON.stringify({
      points,
      spatialReference: { wkid: 4326 },
    }),
  );
  url.searchParams.set('geometryType', 'esriGeometryMultipoint');
  url.searchParams.set('returnFirstValueOnly', 'true');
  url.searchParams.set('f', 'json');

  try {
    const payload = await fetchJson(url, {
      fetchImpl,
      signal: createTimeoutSignal(signal, timeoutMs),
    });
    return {
      ok: true,
      sourceId: source.id,
      sourceName: source.name,
      samples: parseImageSamples(payload),
    };
  } catch (error) {
    return {
      ok: false,
      sourceId: source.id,
      sourceName: source.name,
      samples: [],
      error,
    };
  }
}

async function sampleImageServiceBatched(
  source,
  points,
  {
    fetchImpl,
    signal,
    chunkSize = 800,
  } = {},
) {
  const batches = [];
  for (let index = 0; index < points.length; index += chunkSize)
    batches.push(points.slice(index, index + chunkSize));

  const results = await Promise.all(
    batches.map((batch) =>
      sampleImageService(source, batch, { fetchImpl, signal }),
    ),
  );

  const successful = results.filter((result) => result.ok);
  return {
    ok: successful.length > 0,
    sourceId: source.id,
    sourceName: source.name,
    samples: successful.flatMap((result) => result.samples),
    errors: results.filter((result) => !result.ok).map((result) => result.error),
  };
}

function magneticCenterScore(sample) {
  const value = sample ? finite(sample.value) : null;
  if (value == null) return null;
  return Math.round(
    clamp(100 * (1 - Math.exp(-Math.abs(value) / 450))) * 10,
  ) / 10;
}

function offsetPoint(target, deltaKmEast, deltaKmNorth) {
  const lat = finite(target.latitude);
  const lon = finite(target.longitude);
  const latRadians = (lat * Math.PI) / 180;
  const cosLat = Math.max(0.15, Math.cos(latRadians));
  return [
    lon + deltaKmEast / (111.32 * cosLat),
    lat + deltaKmNorth / 111.32,
  ];
}

function nearestSample(samples, target) {
  let best = null;
  let bestDistance = Infinity;
  for (const sample of samples) {
    const dx = (sample.longitude - target.longitude) * 111.32;
    const dy = (sample.latitude - target.latitude) * 111.32;
    const distance = Math.hypot(dx, dy);
    if (distance < bestDistance) {
      best = sample;
      bestDistance = distance;
    }
  }
  return best;
}

function magneticScore(samples, target) {
  const center = nearestSample(samples, target);
  const values = samples.map((sample) => sample.value).filter(Number.isFinite);
  if (!center || !values.length) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const anomaly = Math.abs(center.value);

  const anomalyEvidence = 100 * (1 - Math.exp(-anomaly / 450));
  const contrastEvidence = 100 * (1 - Math.exp(-range / 300));

  return {
    geophysics: Math.round(
      clamp(anomalyEvidence * 0.62 + contrastEvidence * 0.38) * 10,
    ) / 10,
    structure: Math.round(contrastEvidence * 10) / 10,
    anomalyNt: Math.round(center.value * 10) / 10,
    localRangeNt: Math.round(range * 10) / 10,
    sampleCount: values.length,
  };
}

function terrainScore(samples, target) {
  const center = nearestSample(samples, target);
  if (!center) return null;

  const elevations = samples.map((sample) => sample.value).filter(Number.isFinite);
  if (elevations.length < 2) return null;

  const elevationRange = Math.max(...elevations) - Math.min(...elevations);
  const weakSurfaceExpression = 100 * Math.exp(-Math.abs(elevationRange - 250) / 400);

  return {
    terrain: Math.round(clamp(weakSurfaceExpression) * 10) / 10,
    elevationM: Math.round(center.value * 10) / 10,
    localReliefM: Math.round(elevationRange * 10) / 10,
    interpretation:
      'Weak surface-expression context only; terrain is not a direct mineralization indicator.',
  };
}

export function geologyScore(lithology, target) {
  const normalized = String(lithology || '').toLowerCase().trim();
  if (!normalized || normalized.includes('no data') || normalized.includes('water'))
    return null;

  const keys = targetCommodityKeys(target);
  const scores = [];
  for (const key of keys) {
    const prior = LITHOLOGY_PRIORS[key];
    if (!prior) continue;
    for (const [rock, score] of Object.entries(prior)) {
      if (normalized === rock || normalized.includes(rock))
        scores.push(score);
    }
  }

  if (!scores.length) return 50;
  return Math.round(
    (scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10,
  ) / 10;
}

export function computeTrueEvidence(
  target,
  { geology, magnetics, terrain } = {},
) {
  const channels = {};
  const diagnostics = {};

  if (geology && geology.score != null) {
    channels.geology = geology.score;
    diagnostics.geology = geology;
  }
  if (magnetics) {
    if (magnetics.geophysics != null) channels.geophysics = magnetics.geophysics;
    if (magnetics.structure != null) channels.structure = magnetics.structure;
    diagnostics.magnetics = magnetics;
  }
  if (terrain && terrain.terrain != null)
    diagnostics.terrain = terrain;

  const fusion = fuseEvidence(target.score, channels, {
    weights: TRUE_PROSPECTIVITY_WEIGHTS,
  });

  return {
    modelId: TRUE_PROSPECTIVITY_MODEL_ID,
    score: fusion.score,
    confidence: fusion.confidence,
    coverage: fusion.coverage,
    mode: fusion.mode,
    channels,
    diagnostics,
    interpretation:
      'Multisource geological prospectivity ranking. The score is a model inference and is not a probability of discovery or a resource estimate.',
  };
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runWorker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        results[index] = { ok: false, error };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => runWorker(),
  );
  await Promise.all(workers);
  return results;
}

export async function enrichTargetsWithTrueProspectivity(
  targets,
  {
    fetchImpl = globalThis.fetch,
    signal,
    concurrency = DEFAULT_CONCURRENCY,
    maxGeologyTargets = 384,
  } = {},
) {
  if (!Array.isArray(targets) || !targets.length)
    return {
      targets: [],
      providerStatuses: {
        geology: { ok: false, sourceId: PROSPECTIVITY_SOURCES.geology.id },
        geophysics: { ok: false, sourceId: PROSPECTIVITY_SOURCES.magnetics.id },
        terrain: { ok: false, sourceId: PROSPECTIVITY_SOURCES.terrain.id },
      },
    };

  const centerPoints = targets.map((target) => [
    target.longitude,
    target.latitude,
  ]);

  const centerMagneticResult = await sampleImageServiceBatched(
    PROSPECTIVITY_SOURCES.magnetics,
    centerPoints,
    { fetchImpl, signal },
  );

  const centerMagneticScores = centerMagneticResult.samples.map(
    (sample) => magneticCenterScore(sample),
  );

  const rankedForDetail = targets
    .map((target, index) => ({
      target,
      index,
      centerMagneticScore: centerMagneticScores[index] || 0,
    }))
    .sort(
      (a, b) =>
        (b.centerMagneticScore + a.target.score * 0.35) -
        (a.centerMagneticScore + b.target.score * 0.35),
    );

  const detailCount = Math.min(
    Math.max(1, Number(maxGeologyTargets) || 384),
    targets.length,
  );
  const detailed = rankedForDetail.slice(0, detailCount);
  const detailedTargets = detailed.map((entry) => entry.target);
  const detailedIndexes = detailed.map((entry) => entry.index);

  const magneticsPoints = [];
  const magneticsPointKeys = [];
  const terrainPoints = [];
  const terrainPointKeys = [];

  for (const target of detailedTargets) {
    const magneticOffsets = [
      [0, 0],
      [-5, 0],
      [5, 0],
      [0, -5],
      [0, 5],
      [-5, -5],
      [-5, 5],
      [5, -5],
      [5, 5],
    ];

    for (const offset of magneticOffsets) {
      magneticsPoints.push(offsetPoint(target, offset[0], offset[1]));
      magneticsPointKeys.push(target.id);
    }

    const terrainOffsets = [
      [0, 0],
      [-2, 0],
      [2, 0],
      [0, -2],
      [0, 2],
    ];

    for (const offset of terrainOffsets) {
      terrainPoints.push(offsetPoint(target, offset[0], offset[1]));
      terrainPointKeys.push(target.id);
    }
  }

  const [
    magneticResult,
    terrainResult,
    geologyResults,
  ] = await Promise.all([
    sampleImageServiceBatched(
      PROSPECTIVITY_SOURCES.magnetics,
      magneticsPoints,
      { fetchImpl, signal },
    ),
    sampleImageServiceBatched(
      PROSPECTIVITY_SOURCES.terrain,
      terrainPoints,
      { fetchImpl, signal },
    ),
    mapWithConcurrency(detailedTargets, concurrency, (target) =>
      queryGlmLithology(target, { fetchImpl, signal }),
    ),
  ]);

  const byTargetMagnetic = new Map();
  for (let index = 0; index < magneticResult.samples.length; index += 1) {
    const key = magneticsPointKeys[index];
    if (!key) continue;
    if (!byTargetMagnetic.has(key)) byTargetMagnetic.set(key, []);
    byTargetMagnetic.get(key).push(magneticResult.samples[index]);
  }

  const byTargetTerrain = new Map();
  for (let index = 0; index < terrainResult.samples.length; index += 1) {
    const key = terrainPointKeys[index];
    if (!key) continue;
    if (!byTargetTerrain.has(key)) byTargetTerrain.set(key, []);
    byTargetTerrain.get(key).push(terrainResult.samples[index]);
  }

  const geologyByIndex = new Map();
  for (let index = 0; index < geologyResults.length; index += 1)
    geologyByIndex.set(detailedIndexes[index], geologyResults[index]);

  const providerStatuses = {
    geology: {
      ok: geologyResults.some((result) => result && result.ok),
      sourceId: PROSPECTIVITY_SOURCES.geology.id,
      sourceName: PROSPECTIVITY_SOURCES.geology.name,
    },
    geophysics: {
      ok:
        centerMagneticResult.ok &&
        centerMagneticResult.samples.length > 0,
      sourceId: PROSPECTIVITY_SOURCES.magnetics.id,
      sourceName: PROSPECTIVITY_SOURCES.magnetics.name,
    },
    terrain: {
      ok:
        terrainResult.ok &&
        terrainResult.samples.length > 0,
      sourceId: PROSPECTIVITY_SOURCES.terrain.id,
      sourceName: PROSPECTIVITY_SOURCES.terrain.name,
    },
  };

  const enrichedTargets = targets
    .map((target, index) => {
      const geology = geologyByIndex.get(index) || null;
      const magnetics =
        detailedIndexes.includes(index)
          ? magneticScore(
              byTargetMagnetic.get(target.id) || [],
              target,
            )
          : centerMagneticScores[index] != null
            ? {
                geophysics: centerMagneticScores[index],
                structure: centerMagneticScores[index] * 0.7,
                anomalyNt: null,
                localRangeNt: null,
                sampleCount: 1,
                interpretation:
                  'Center-point magnetic evidence only; detailed local gradient was reserved for higher-ranked candidates.',
              }
            : null;
      const terrain = detailedIndexes.includes(index)
        ? terrainScore(
            byTargetTerrain.get(target.id) || [],
            target,
          )
        : null;

      const evidence = computeTrueEvidence(target, {
        geology,
        magnetics,
        terrain,
      });

      const hardExcluded =
        geology &&
        geology.lithology &&
        /water|ice and glaciers/i.test(String(geology.lithology));

      return {
        ...target,
        modelId: TRUE_PROSPECTIVITY_MODEL_ID,
        referenceModelId: target.modelId,
        score: hardExcluded ? 0 : evidence.score,
        tier: hardExcluded
          ? 'EXCLUDED'
          : evidence.score >= 85
            ? 'TIER 1'
            : evidence.score >= 70
              ? 'TIER 2'
              : evidence.score >= 55
                ? 'TIER 3'
                : 'TIER 4',
        evidence: {
          ...target.evidence,
          ...(evidence.channels.geology != null
            ? { geology: Math.round(evidence.channels.geology) }
            : {}),
          ...(evidence.channels.geophysics != null
            ? { geophysics: Math.round(evidence.channels.geophysics) }
            : {}),
          ...(evidence.channels.structure != null
            ? { structure: Math.round(evidence.channels.structure) }
            : {}),
        },
        trueProspectivity: {
          ...evidence,
          hardExcluded: Boolean(hardExcluded),
          detailResolved: detailedIndexes.includes(index),
          providerStatuses,
        },
      };
    })
    .sort((a, b) => b.score - a.score || b.referenceCount - a.referenceCount)
    .map((target, index) => ({
      ...target,
      rank: index + 1,
    }));

  return {
    targets: enrichedTargets,
    providerStatuses,
  };
}

export const DEFAULT_TRUE_CHANNELS = Object.freeze([
  'reference',
  'geology',
  'geophysics',
  'structure',
]);
