import * as Cesium from 'cesium';

/**
 * Google Earth Engine integration for GEM.
 *
 * Earth Engine is used as a global Earth-observation processing/tile backend;
 * Cesium remains the renderer. Credentials stay server-side.
 */
export const GEE_CONFIG = Object.freeze({
  id: 'gee-global-eo',
  label: 'Google Earth Engine',
  shortLabel: 'GEE EO',
  kind: 'gee-imagery',
  endpoint: '/api/gee/map',
  healthEndpoint: '/api/gee/health',
  attribution: 'Google Earth Engine / public Earth observation datasets',
  defaultDataset: 'sentinel2',
});

export const GEE_DATASETS = Object.freeze([
  { key: 'sentinel2', label: 'Sentinel-2 SR Harmonized' },
  { key: 'hls', label: 'HLS Landsat 30 m' },
  { key: 'sentinel1', label: 'Sentinel-1 SAR VV' },
  { key: 'landsat', label: 'Landsat 9 SR' },
  { key: 'elevation', label: 'Copernicus DEM 30 m' },
  { key: 'worldcover', label: 'ESA WorldCover' },
]);

export function geeAvailable(config = {}) {
  return Boolean(String(config.endpoint || GEE_CONFIG.endpoint).trim());
}

export async function createGeeImagery({
  fetchImpl = globalThis.fetch,
  dataset = GEE_CONFIG.defaultDataset,
  visualization = {
    bands: ['B4', 'B3', 'B2'],
    min: 0,
    max: 3000,
    gamma: 1.1,
  },
  region = null,
  startDate = null,
  endDate = null,
  signal,
} = {}) {
  if (typeof fetchImpl !== 'function')
    throw new TypeError('fetch is unavailable');

  const response = await fetchImpl(GEE_CONFIG.endpoint, {
    method: 'POST',
    signal,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dataset,
      visualization,
      region,
      startDate,
      endDate,
    }),
  });

  if (!response.ok)
    throw new Error(
      'Google Earth Engine gateway HTTP ' +
        response.status +
        ' ' +
        response.statusText,
    );

  const payload = await response.json();
  if (!payload || !payload.urlTemplate)
    throw new Error(
      'Google Earth Engine gateway returned no imagery URL template',
    );

  return new Cesium.UrlTemplateImageryProvider({
    url: payload.urlTemplate,
    credit: payload.attribution || GEE_CONFIG.attribution,
  });
}
