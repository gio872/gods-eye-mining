import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSpectralIndices,
  createHlsSpectralSource,
} from './hlsSpectral.js';

function response(body) {
  return {
    ok: true,
    async json() {
      return body;
    },
  };
}

test('spectral indices use HLS Sentinel-2 blue/red/NIR/SWIR bands', () => {
  const indices = computeSpectralIndices({
    B02: 0.10,
    B04: 0.20,
    B8A: 0.50,
    B11: 0.30,
    B12: 0.20,
  });
  assert.ok(indices.ferric > 0);
  assert.ok(indices.ferrous > 0);
  assert.equal(indices.clay, 1.5);
  assert.ok(Math.abs(indices.ndvi - 0.4285714285714286) < 1e-12);
});

test('HLS spectral source selects a scene and returns local anomaly scores', async () => {
  const calls = [];
  const source = createHlsSpectralSource({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.includes('/api/stac/v1/search')) {
        return response({
          type: 'FeatureCollection',
          features: [
            {
              id: 'hls-test-001',
              properties: {
                datetime: '2026-09-20T12:00:00Z',
                'eo:cloud_cover': 10,
              },
            },
          ],
        });
      }
      return response({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              id: 'a',
              statistics: {
                B02: { mean: 0.10 },
                B04: { mean: 0.10 },
                B8A: { mean: 0.40 },
                B11: { mean: 0.20 },
                B12: { mean: 0.20 },
              },
            },
          },
          {
            type: 'Feature',
            properties: {
              id: 'b',
              statistics: {
                B02: { mean: 0.10 },
                B04: { mean: 0.12 },
                B8A: { mean: 0.40 },
                B11: { mean: 0.21 },
                B12: { mean: 0.20 },
              },
            },
          },
          {
            type: 'Feature',
            properties: {
              id: 'c',
              statistics: {
                B02: { mean: 0.10 },
                B04: { mean: 0.30 },
                B8A: { mean: 0.40 },
                B11: { mean: 0.35 },
                B12: { mean: 0.20 },
              },
            },
          },
        ],
      });
    },
  });

  const result = await source.getEvidence({
    center: { lat: 4.45, lon: -75.2 },
    points: [
      { id: 'a', lat: 4.45, lon: -75.20 },
      { id: 'b', lat: 4.451, lon: -75.201 },
      { id: 'c', lat: 4.452, lon: -75.202 },
    ],
  });

  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /assets=B02/);
  assert.match(calls[1].options.body, /\"geojson\"/);
  assert.equal(result.source, 'Microsoft Planetary Computer · HLS S30 (Sentinel-2)');
  assert.equal(result.itemId, 'hls-test-001');
  assert.equal(result.featureCount, 3);
  assert.ok(result.values[2] > result.values[0]);
  assert.equal(result.indices.length, 3);
});
