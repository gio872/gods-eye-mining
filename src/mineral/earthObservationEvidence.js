
const DEFAULT_STAC_LIMIT = 4;
const DEFAULT_RADIUS_METERS = 60;
const EMIT_HALF_COVERAGE_LAT = 52;

export const EARTH_OBSERVATION_SOURCES = Object.freeze({
  sentinel2: Object.freeze({
    id: 'sentinel-2-l2a-earth-search',
    name: 'Sentinel-2 L2A COG (Element84 Earth Search)',
    stac: 'https://earth-search.aws.element84.com/v1',
    collection: 'sentinel-2-l2a',
    sourceBias: 'Surface reflectance used for deterministic alteration proxies; cloud-screened.',
  }),
  enmap: Object.freeze({
    id: 'enmap-l2a-dlr-stac',
    name: 'EnMAP HSI Level 2A (DLR EOC Geoservice)',
    stac: 'https://geoservice.dlr.de/eoc/ogc/stac/v1',
    collection: 'ENMAP_HSI_L2A',
    sourceBias: 'Atmospherically corrected hyperspectral surface reflectance; COG, 30 km tiles.',
  }),
  emit: Object.freeze({
    id: 'emit-l2bmin-earthdata',
    name: 'NASA EMIT L2B Mineral Identification / Band Depth',
    cmr: 'https://cmr.earthdata.nasa.gov/search/granules.json',
    shortName: 'EMITL2BMIN',
    version: '001',
    resolutionMeters: 60,
    sourceBias: 'Direct mineral-identification evidence when authenticated L2BMIN granule access is available.',
  }),
});

const STAC_CACHE = new Map();
const COG_CACHE = new Map();

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function median(values) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) return null;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
}

function sigmoid(value, center, scale) {
  return 100 / (1 + Math.exp(-(value - center) / scale));
}

function stacBbox(target, halfDegrees) {
  return [
    Math.max(-180, Number(target.longitude) - halfDegrees),
    Math.max(-90, Number(target.latitude) - halfDegrees),
    Math.min(180, Number(target.longitude) + halfDegrees),
    Math.min(90, Number(target.latitude) + halfDegrees),
  ];
}

async function fetchJson(url, { fetchImpl, signal } = {}) {
  const response = await fetchImpl(url, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + response.statusText);
  return response.json();
}

async function searchStac(source, target, { fetchImpl = globalThis.fetch, signal, halfDegrees = 0.35, limit = DEFAULT_STAC_LIMIT } = {}) {
  const bbox = stacBbox(target, halfDegrees);
  const key = [source.stac, source.collection, bbox.join(','), limit].join('|');
  if (STAC_CACHE.has(key)) return STAC_CACHE.get(key);

  const url = new URL(source.stac + '/search');
  url.searchParams.set('collections', source.collection);
  url.searchParams.set('bbox', bbox.join(','));
  url.searchParams.set('limit', String(limit));
  if (source.id.startsWith('sentinel-2')) {
    url.searchParams.set('query', JSON.stringify({ 'eo:cloud_cover': { lt: 35 } }));
  }
  const payload = await fetchJson(url, { fetchImpl, signal });
  const items = Array.isArray(payload.features) ? payload.features : [];
  const promise = Promise.resolve(items);
  STAC_CACHE.set(key, promise);
  return items;
}

function utmProject(longitude, latitude, epsg) {
  const code = Number(epsg);
  if (!Number.isFinite(code) || code < 32601 || code > 32760) return null;
  const zone = code >= 32701 ? code - 32700 : code - 32600;
  const northern = code >= 32601 && code <= 32660;
  const a = 6378137;
  const flattening = 1 / 298.257223563;
  const e2 = flattening * (2 - flattening);
  const ep2 = e2 / (1 - e2);
  const k0 = 0.9996;
  const latRad = (latitude * Math.PI) / 180;
  const lonRad = (longitude * Math.PI) / 180;
  const lon0 = (((zone - 1) * 6 - 180 + 3) * Math.PI) / 180;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const tanLat = Math.tan(latRad);
  const n = a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const t = tanLat * tanLat;
  const c = ep2 * cosLat * cosLat;
  const aa = cosLat * (lonRad - lon0);
  const m = a * (
    (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256) * latRad -
    ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * latRad) +
    ((15 * e2 * e2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * latRad) -
    ((35 * e2 ** 3) / 3072) * Math.sin(6 * latRad)
  );
  const east = k0 * n * (
    aa +
    ((1 - t + c) * aa ** 3) / 6 +
    ((5 - 18 * t + t * t + 72 * c - 58 * ep2) * aa ** 5) / 120
  ) + 500000;
  let north = k0 * (
    m +
    n * tanLat * (
      aa ** 2 / 2 +
      ((5 - t + 9 * c + 4 * c * c) * aa ** 4) / 24 +
      ((61 - 58 * t + t * t + 600 * c - 330 * ep2) * aa ** 6) / 720
    )
  );
  if (!northern) north += 10000000;
  return [east, north];
}

function transformForAsset(item, asset) {
  const transform =
    (asset && Array.isArray(asset['proj:transform'])
      ? asset['proj:transform']
      : null) ||
    (item &&
    item.properties &&
    Array.isArray(item.properties['proj:transform'])
      ? item.properties['proj:transform']
      : null);
  if (!transform || transform.length < 6) return null;
  return {
    scaleX: Number(transform[0]),
    scaleY: Number(transform[4]),
    originX: Number(transform[2]),
    originY: Number(transform[5]),
  };
}

function assetEpsg(item, asset) {
  const itemEpsg = item && item.properties ? item.properties['proj:epsg'] : null;
  return finite(asset && asset['proj:epsg']) || finite(itemEpsg);
}

async function openCog(href) {
  if (COG_CACHE.has(href)) return COG_CACHE.get(href);
  const module = await import('geotiff');
  const promise = module.fromUrl(href);
  COG_CACHE.set(href, promise);
  return promise;
}

async function readCogSamples(item, asset, target, { radiusMeters = DEFAULT_RADIUS_METERS, samples = [0] } = {}) {
  if (!asset || !asset.href) throw new Error('COG asset is unavailable');
  const transform = transformForAsset(item, asset);
  const epsg = assetEpsg(item, asset);
  if (!transform || !epsg) throw new Error('Projected STAC transform is unavailable');
  const projected = utmProject(finite(target.longitude), finite(target.latitude), epsg);
  if (!projected) throw new Error('Only UTM projected COGs are supported');
  const pixelX = (projected[0] - transform.originX) / transform.scaleX;
  const pixelY = (projected[1] - transform.originY) / transform.scaleY;
  const radiusX = Math.max(1, Math.ceil(radiusMeters / Math.abs(transform.scaleX)));
  const radiusY = Math.max(1, Math.ceil(radiusMeters / Math.abs(transform.scaleY)));
  const tiff = await openCog(asset.href);
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  if (pixelX < 0 || pixelY < 0 || pixelX >= width || pixelY >= height) throw new Error('Target is outside the COG extent');
  const x0 = Math.max(0, Math.floor(pixelX) - radiusX);
  const y0 = Math.max(0, Math.floor(pixelY) - radiusY);
  const x1 = Math.min(width, Math.floor(pixelX) + radiusX + 1);
  const y1 = Math.min(height, Math.floor(pixelY) + radiusY + 1);
  const raster = await image.readRasters({
    window: [x0, y0, x1, y1],
    samples,
    interleave: false,
  });
  const nodata = image.getGDALNoData ? image.getGDALNoData() : null;
  const rasterBands = Array.isArray(asset['raster:bands']) ? asset['raster:bands'] : [];
  return {
    arrays: Array.from(raster).map((array, index) => {
      const metadata = rasterBands[index] || rasterBands[0] || {};
      const scale = finite(metadata.scale) ?? 1;
      const offset = finite(metadata.offset) ?? 0;
      return Array.from(array).map((value) => {
        if (!Number.isFinite(value) || (nodata != null && Number(value) === Number(nodata)))
          return null;
        return Number(value) * scale + offset;
      });
    }),
    nodata,
  };
}

function findSentinelAsset(item, key) {
  return item && item.assets ? item.assets[key] || null : null;
}

async function sampleSentinel2(item, target) {
  const results = {};
  for (const key of ['B02', 'B04', 'B08', 'B11', 'B12']) {
    const asset = findSentinelAsset(item, key);
    if (!asset) continue;
    const sample = await readCogSamples(item, asset, target, {
      radiusMeters: key === 'B02' || key === 'B04' || key === 'B08' ? 60 : 80,
    });
    results[key] = median(sample.arrays[0]);
  }
  const sclAsset = findSentinelAsset(item, 'SCL');
  if (sclAsset) {
    const scl = await readCogSamples(item, sclAsset, target, { radiusMeters: 80 });
    const values = scl.arrays[0].filter(Number.isFinite);
    const invalidPixels = values.filter((value) =>
      [0, 1, 3, 6, 8, 9, 10, 11].includes(Math.round(value)),
    ).length;
    const cloudPixels = values.filter((value) =>
      [3, 8, 9, 10, 11].includes(Math.round(value)),
    ).length;
    results.cloudFraction = values.length ? invalidPixels / values.length : 1;
    results.cloudScreened = cloudPixels < Math.max(1, values.length * 0.2);
  }
  return results;
}

function wavelengthBandIndex(item, targetWavelength) {
  const asset = item && item.assets ? item.assets.image : null;
  const bands = asset && Array.isArray(asset['eo:bands']) ? asset['eo:bands'] : [];
  let bestIndex = -1;
  let bestDistance = Infinity;
  for (let index = 0; index < bands.length; index += 1) {
    const wavelength = finite(bands[index] && bands[index].center_wavelength);
    if (wavelength == null) continue;
    const distance = Math.abs(wavelength - targetWavelength);
    if (distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  }
  return {
    asset,
    index: bestIndex,
    wavelength: bestIndex >= 0 ? bands[bestIndex].center_wavelength : null,
  };
}

async function sampleEnmap(item, target) {
  const desired = {
    blue: 0.45,
    red: 0.66,
    nir: 0.85,
    swir1: 1.65,
    swir21: 2.10,
    swir2: 2.20,
    swir23: 2.30,
  };
  const selections = Object.entries(desired).map(([name, wavelength]) => ({
    name,
    ...wavelengthBandIndex(item, wavelength),
  }));
  const valid = selections.filter((entry) => entry.asset && entry.asset.href && entry.index >= 0);
  if (!valid.length) throw new Error('EnMAP spectral-band metadata unavailable');
  const sample = await readCogSamples(item, valid[0].asset, target, {
    radiusMeters: 90,
    samples: valid.map((entry) => entry.index),
  });
  const result = {};
  valid.forEach((entry, index) => {
    result[entry.name] = median(sample.arrays[index]);
  });
  return result;
}

export function spectralAlterationScore(spectral, { source = 'unknown' } = {}) {
  if (!spectral) return null;
  const blue = finite(spectral.blue);
  const red = finite(spectral.red);
  const nir = finite(spectral.nir);
  const swir1 = finite(spectral.swir1);
  const swir2 = finite(spectral.swir2);
  if ([blue, red, swir1, swir2].some((value) => value == null || value <= 0)) return null;
  const ferricRatio = red / blue;
  const clayRatio = swir1 / swir2;
  const ndvi = nir != null && nir + red !== 0 ? (nir - red) / (nir + red) : null;
  const ferric = sigmoid(ferricRatio, 1.15, 0.16);
  const clay = sigmoid(clayRatio, 0.95, 0.08);
  const drySurface = ndvi == null ? 50 : sigmoid(-ndvi, -0.15, 0.12);
  const score = clamp(ferric * 0.45 + clay * 0.35 + drySurface * 0.2);
  return {
    score: Math.round(score * 10) / 10,
    ferricRatio: Math.round(ferricRatio * 1000) / 1000,
    clayRatio: Math.round(clayRatio * 1000) / 1000,
    ndvi: ndvi == null ? null : Math.round(ndvi * 1000) / 1000,
    source,
  };
}

export function enmapSpectralScore(spectral) {
  const base = spectralAlterationScore(spectral, { source: 'EnMAP L2A' });
  if (!base) return null;
  const swir21 = finite(spectral && spectral.swir21);
  const swir23 = finite(spectral && spectral.swir23);
  const swir2 = finite(spectral && spectral.swir2);
  if ([swir21, swir23, swir2].every((value) => value != null && value > 0)) {
    const absorption = 1 - swir2 / Math.max(1e-9, (swir21 + swir23) / 2);
    const clayAbsorption = clamp(sigmoid(absorption, 0.015, 0.02));
    base.score = Math.round(clamp(base.score * 0.75 + clayAbsorption * 25) * 10) / 10;
    base.clayAbsorption = Math.round(absorption * 10000) / 10000;
  }
  return base;
}

function bestStacItem(items, target) {
  const covering = items.filter((item) => {
    const bbox = Array.isArray(item.bbox) ? item.bbox : null;
    return bbox && bbox.length >= 4 &&
      target.longitude >= bbox[0] && target.longitude <= bbox[2] &&
      target.latitude >= bbox[1] && target.latitude <= bbox[3];
  });
  const candidates = covering.length ? covering : items;
  return [...candidates].sort((a, b) => {
    const cloudA = finite(a.properties && a.properties['eo:cloud_cover']) ?? 100;
    const cloudB = finite(b.properties && b.properties['eo:cloud_cover']) ?? 100;
    if (cloudA !== cloudB) return cloudA - cloudB;
    return String(b.properties && b.properties.datetime).localeCompare(String(a.properties && a.properties.datetime));
  })[0] || null;
}

async function searchEmitL2BMIN(target, { fetchImpl = globalThis.fetch, signal, limit = 3 } = {}) {
  const url = new URL(EARTH_OBSERVATION_SOURCES.emit.cmr);
  url.searchParams.set('short_name', EARTH_OBSERVATION_SOURCES.emit.shortName);
  url.searchParams.set('version', EARTH_OBSERVATION_SOURCES.emit.version);
  url.searchParams.set('bounding_box', stacBbox(target, 0.5).join(','));
  url.searchParams.set('page_size', String(limit));
  url.searchParams.set('format', 'json');
  const payload = await fetchJson(url, { fetchImpl, signal });
  return payload && payload.feed && Array.isArray(payload.feed.entry) ? payload.feed.entry : [];
}

function authRequiredEmitResult(granule) {
  return {
    ok: false,
    channel: 'spectral',
    status: 'AUTH_REQUIRED',
    granuleId: granule ? granule.id || granule.title || null : null,
    message: 'EMIT L2BMIN granule discovered. Authenticated Earthdata access is required for the protected NetCDF-4 pixel product.',
  };
}

async function sampleEmitL2BMIN(target, granule, { emitSampler, signal } = {}) {
  if (!granule) return { ok: false, channel: 'spectral', status: 'NO_COVERAGE' };
  if (typeof emitSampler !== 'function') return authRequiredEmitResult(granule);
  try {
    const result = await emitSampler({
      target,
      granule,
      source: EARTH_OBSERVATION_SOURCES.emit,
      signal,
    });
    if (!result || result.score == null) return authRequiredEmitResult(granule);
    return {
      ok: true,
      channel: 'spectral',
      provider: 'emit',
      score: clamp(Number(result.score)),
      mineralNames: Array.isArray(result.mineralNames) ? result.mineralNames : [],
      bandDepth: finite(result.bandDepth),
      fitScore: finite(result.fitScore),
      uncertainty: finite(result.uncertainty),
      granuleId: granule.id || granule.title || null,
      sourceId: EARTH_OBSERVATION_SOURCES.emit.id,
      sourceName: EARTH_OBSERVATION_SOURCES.emit.name,
    };
  } catch (error) {
    return { ok: false, channel: 'spectral', status: 'ERROR', error };
  }
}

export async function enrichSpectralEvidence(target, { fetchImpl = globalThis.fetch, signal, emitSampler } = {}) {
  const result = {
    spectral: null,
    sentinel2: { ok: false, status: 'OFF' },
    enmap: { ok: false, status: 'OFF' },
    emit: {
      ok: false,
      status: Math.abs(Number(target.latitude)) <= EMIT_HALF_COVERAGE_LAT ? 'SEARCHING' : 'OUTSIDE_NOMINAL_COVERAGE',
    },
    diagnostics: {},
  };

  const [sentinelOutcome, enmapOutcome, emitOutcome] = await Promise.allSettled([
    searchStac(EARTH_OBSERVATION_SOURCES.sentinel2, target, { fetchImpl, signal, halfDegrees: 0.25, limit: 2 }).then(async (items) => {
      const item = bestStacItem(items, target);
      if (!item) return { ok: false, status: 'NO_COVERAGE' };
      try {
        const sample = await sampleSentinel2(item, target);
        const score = sample.cloudScreened === false ? null : spectralAlterationScore(sample, { source: 'Sentinel-2 L2A' });
        return { ok: Boolean(score), score, itemId: item.id, cloudFraction: sample.cloudFraction, status: score ? 'READY' : 'NO_VALID_PIXEL' };
      } catch (error) {
        return { ok: false, status: 'ERROR', error };
      }
    }),
    searchStac(EARTH_OBSERVATION_SOURCES.enmap, target, { fetchImpl, signal, halfDegrees: 0.4, limit: 4 }).then(async (items) => {
      const item = bestStacItem(items, target);
      if (!item) return { ok: false, status: 'NO_COVERAGE' };
      try {
        const sample = await sampleEnmap(item, target);
        const score = enmapSpectralScore(sample);
        return { ok: Boolean(score), score, itemId: item.id, status: score ? 'READY' : 'NO_VALID_PIXEL' };
      } catch (error) {
        return { ok: false, status: 'ERROR', error };
      }
    }),
    searchEmitL2BMIN(target, { fetchImpl, signal }).then(async (granules) => sampleEmitL2BMIN(target, granules[0] || null, { emitSampler, signal })),
  ]);

  result.sentinel2 = sentinelOutcome.status === 'fulfilled'
    ? sentinelOutcome.value
    : { ok: false, status: 'ERROR', error: sentinelOutcome.reason };
  result.enmap = enmapOutcome.status === 'fulfilled'
    ? enmapOutcome.value
    : { ok: false, status: 'ERROR', error: enmapOutcome.reason };
  result.emit = emitOutcome.status === 'fulfilled'
    ? emitOutcome.value
    : { ok: false, status: 'ERROR', error: emitOutcome.reason };

  for (const [key, provider] of [['sentinel2', result.sentinel2], ['enmap', result.enmap]]) {
    if (provider && provider.score) result.diagnostics[key] = provider.score;
  }
  if (result.emit && result.emit.score != null) result.diagnostics.emit = result.emit;

  const scores = [result.sentinel2.score, result.enmap.score, result.emit.score]
    .filter((value) => value != null)
    .map((value) => Number(value && value.score != null ? value.score : value));
  if (scores.length) result.spectral = Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length * 10) / 10;
  return result;
}

export function summarizeSpectralProviders(result) {
  return {
    ok: Boolean(result && result.spectral != null),
    activeProviders: [
      result && result.emit && result.emit.ok ? 'EMIT L2BMIN' : null,
      result && result.enmap && result.enmap.ok ? 'EnMAP L2A' : null,
      result && result.sentinel2 && result.sentinel2.ok ? 'Sentinel-2 L2A' : null,
    ].filter(Boolean),
  };
}
