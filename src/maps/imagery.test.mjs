import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEsriImagery,
  ESRI_WORLD_IMAGERY_SERVICE,
  ESRI_WORLD_IMAGERY_TILES,
} from './imagery.js';

test('Esri World Imagery keeps the metadata-backed satellite provider when available', async () => {
  const expected = { provider: 'arcgis-imagery' };
  const fake = {
    ArcGisMapServerImageryProvider: {
      async fromUrl(url, options) {
        assert.equal(url, ESRI_WORLD_IMAGERY_SERVICE);
        assert.match(options.credit, /Powered by Esri/);
        return expected;
      },
    },
  };
  assert.equal(await createEsriImagery(fake), expected);
});

test('Esri metadata failure falls back to direct global World Imagery tiles', async () => {
  const fake = {
    ArcGisMapServerImageryProvider: {
      async fromUrl() { throw new Error('metadata endpoint is blocked'); },
    },
    WebMercatorTilingScheme: class WebMercatorTilingScheme {},
    Rectangle: { fromDegrees(...coordinates) { return { coordinates }; } },
    UrlTemplateImageryProvider: class UrlTemplateImageryProvider {
      constructor(options) { this.options = options; }
    },
  };
  const priorWarn = console.warn;
  console.warn = () => {};
  try {
    const provider = await createEsriImagery(fake);
    assert.equal(provider.options.url, ESRI_WORLD_IMAGERY_TILES);
    assert.match(provider.options.url, /World_Imagery\/MapServer\/tile\/\{z\}\/\{y\}\/\{x\}$/);
    assert.equal(provider.options.maximumLevel, 19);
    assert.equal(provider.options.tilingScheme instanceof fake.WebMercatorTilingScheme, true);
    assert.deepEqual(provider.options.rectangle.coordinates, [-180, -85.05112878, 180, 85.05112878]);
  } finally {
    console.warn = priorWarn;
  }
});
