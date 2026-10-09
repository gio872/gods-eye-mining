import * as Cesium from 'cesium';

// Attribution and service rights are documented in DATA_SOURCES.md.
export const ESRI_ATTRIBUTION_HTML =
  '<a href="https://www.esri.com" target="_blank" rel="noopener">Powered by Esri</a>';

export const ESRI_WORLD_IMAGERY_SERVICE =
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer';

export const ESRI_WORLD_IMAGERY_TILES =
  ESRI_WORLD_IMAGERY_SERVICE + '/tile/{z}/{y}/{x}';

export function createOsmImagery(CesiumApi = Cesium) {
  return new CesiumApi.OpenStreetMapImageryProvider({
    url: 'https://tile.openstreetmap.org/',
    credit: '© OpenStreetMap contributors',
  });
}

/**
 * Prefer the ArcGIS metadata-backed provider, but keep a direct tile URL
 * fallback for networks that block MapServer metadata queries while allowing
 * cached/REST tiles. The controller still falls back to OSM if tile delivery
 * itself fails, so the viewer never silently remains a blank globe.
 */
export async function createEsriImagery(CesiumApi = Cesium) {
  const options = {
    credit:
      'Powered by Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    enablePickFeatures: false,
  };
  try {
    return await CesiumApi.ArcGisMapServerImageryProvider.fromUrl(
      ESRI_WORLD_IMAGERY_SERVICE,
      options,
    );
  } catch (error) {
    console.warn(
      '[MapStack] ArcGIS imagery metadata unavailable; using direct World Imagery tiles:',
      error?.message || error,
    );
    return new CesiumApi.UrlTemplateImageryProvider({
      url: ESRI_WORLD_IMAGERY_TILES,
      tilingScheme: new CesiumApi.WebMercatorTilingScheme(),
      rectangle: CesiumApi.Rectangle.fromDegrees(
        -180,
        -85.05112878,
        180,
        85.05112878,
      ),
      maximumLevel: 19,
      credit: options.credit,
      enablePickFeatures: false,
    });
  }
}

export function createIonImagery(style, accessToken, CesiumApi = Cesium) {
  accessToken = String(accessToken || '').trim();
  if (!accessToken) throw new Error('Ion imagery requires an explicit token');
  return CesiumApi.IonImageryProvider.fromAssetId(style, { accessToken });
}
