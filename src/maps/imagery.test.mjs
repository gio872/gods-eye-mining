import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEsriImagery,
  ESRI_WORLD_IMAGERY_SERVICE,
  ESRI_WORLD_IMAGERY_TILES,
} from './imagery.js';

function fakeCesium({ throwDirect = false } = {}) {
  return {
    UrlTemplateImageryProvider: class UrlTemplateImageryProvider {
      constructor(options) {
        if (throwDirect) throw new Error('direct tiles unavailable');
        this.options = options;
      }
    },
    WebMercatorTilingScheme: class WebMercatorTilingScheme {},
    Rectangle: { fromDegrees(...coordinates) { return { coordinates }; } },
    ArcGisMapServerImageryProvider: {
      async fromUrl(url, options) {
        assert.equal(url, ESRI_WORLD_IMAGERY_SERVICE);
        assert.match(options.credit, /Powered by Esri/);
        return { provider: 'arcgis-imagery' };
      },
    },
  };
}

test('global satellite startup requests World Imagery tiles directly without waiting for metadata', () => {
  const fake = fakeCesium();
  const provider = createEsriImagery(fake);
  assert.equal(provider.options.url, ESRI_WORLD_IMAGERY_TILES);
  assert.match(provider.options.url, /World_Imagery\/MapServer\/tile\/\{z\}\/\{y\}\/\{x\}$/);
  assert.equal(provider.options.maximumLevel, 19);
  assert.equal(provider.options.tilingScheme instanceof fake.WebMercatorTilingScheme, true);
  assert.deepEqual(provider.options.rectangle.coordinates, [-180, -85.05112878, 180, 85.05112878]);
  assert.match(provider.options.credit, /Powered by Esri/);
});

test('ArcGIS metadata factory remains available if direct provider construction fails', async () => {
  const priorWarn = console.warn;
  console.warn = () => {};
  try {
    const provider = await createEsriImagery(fakeCesium({ throwDirect: true }));
    assert.deepEqual(provider, { provider: 'arcgis-imagery' });
  } finally {
    console.warn = priorWarn;
  }
});
