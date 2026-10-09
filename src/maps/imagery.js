import * as Cesium from 'cesium';

// Attribution and service rights are documented in DATA_SOURCES.md.
export const ESRI_ATTRIBUTION_HTML =
  '<a href="https://www.esri.com" target="_blank" rel="noopener">Powered by Esri</a>';

export const ESRI_WORLD_IMAGERY_SERVICE =
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer';

// Alternate ArcGIS tile host lets the initial viewer request imagery tiles
// directly instead of first depending on a separate MapServer metadata query.
export const ESRI_WORLD_IMAGERY_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export function createOsmImagery(CesiumApi = Cesium) {
  return new CesiumApi.OpenStreetMapImageryProvider({
    url: 'https://tile.openstreetmap.org/',
    credit: '© OpenStreetMap contributors',
  });
}

/**
 * Start with the public global satellite tile endpoint directly. If that
 * provider cannot even be constructed, use the metadata-backed ArcGIS factory
 * as a secondary route. Tile request failures are handled by the map controller
 * which can switch to the next configured map source.
 */
export function createEsriImagery(CesiumApi = Cesium) {
  const options = {
    credit:
      'Powered by Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    enablePickFeatures: false,
  };
  try {
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
  } catch (error) {
    console.warn(
      '[MapStack] Direct World Imagery tiles unavailable; trying ArcGIS MapServer metadata:',
      error?.message || error,
    );
    return CesiumApi.ArcGisMapServerImageryProvider.fromUrl(
      ESRI_WORLD_IMAGERY_SERVICE,
      options,
    );
  }
}

export function createIonImagery(style, accessToken, CesiumApi = Cesium) {
  accessToken = String(accessToken || '').trim();
  if (!accessToken) throw new Error('Ion imagery requires an explicit token');
  return CesiumApi.IonImageryProvider.fromAssetId(style, { accessToken });
}
