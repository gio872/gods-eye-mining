import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSgcGeologySource } from './sgcGeology.js';

function response(features) {
  return {
    ok: true,
    async json() {
      return { type: 'FeatureCollection', features };
    },
  };
}

test('SGC geology source scores nearby commodity evidence and keeps metadata', async () => {
  const calls = [];
  const source = createSgcGeologySource({
    fetchImpl: async (url) => {
      calls.push(url);
      if (url.includes('/MapServer/0/')) {
        return response([
          {
            geometry: { type: 'Point', coordinates: [-75.2, 4.45] },
            properties: {
              MMC_SIM_ST: 'Au, Depositos de placer, Deposito (productor o productor pasado)',
              MMC_SYMB: 'Au, Depositos de placer',
              ID_NOM_DEP: 'Test gold deposit',
            },
          },
        ]);
      }
      if (url.includes('/MapServer/1/')) {
        return response([
          {
            geometry: { type: 'Point', coordinates: [-75.205, 4.45] },
            properties: {
              MMC_SYMB: 'Au, Depositos de placer',
              ID_NOM_DEP: 'Test gold occurrence',
            },
          },
        ]);
      }
      if (url.includes('/MapServer/1704/')) {
        return response([
          {
            geometry: {
              type: 'LineString',
              coordinates: [
                [-75.201, 4.44],
                [-75.201, 4.46],
              ],
            },
            properties: { Tipo: 'Falla' },
          },
        ]);
      }
      if (url.includes('/MapServer/1709/')) {
        return response([
          {
            geometry: {
              type: 'LineString',
              coordinates: [
                [-75.201, 4.44],
                [-75.201, 4.46],
              ],
            },
            properties: { METAL: 'Au', Style_2022: 'Au' },
          },
        ]);
      }
      return response([
        {
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [-75.21, 4.44],
              [-75.19, 4.44],
              [-75.19, 4.46],
              [-75.21, 4.46],
              [-75.21, 4.44],
            ]],
          },
          properties: {
            SimboloUC: 'K1-Sm',
            Descripcion: 'Unidad geológica de prueba',
          },
        },
      ]);
    },
  });

  const result = await source.getEvidence({
    points: [{ lat: 4.45, lon: -75.2 }],
    center: { lat: 4.45, lon: -75.2 },
    commodity: 'gold',
  });

  assert.equal(calls.length, 5);
  assert.equal(result.commodity, 'gold');
  assert.equal(result.featureCount, 2);
  assert.equal(result.geologyMapFeatureCount, 1);
  assert.ok(result.mineralizationValues[0] > 0.9);
  assert.ok(result.structureValues[0] > 0.9);
  assert.ok(result.alluvialValues[0] > 0.9);
  assert.ok(result.values[0] > 0);
  assert.match(result.source, /SGC/);
});

test('SGC geology source does not assign evidence to unrelated commodities', async () => {
  const source = createSgcGeologySource({
    fetchImpl: async () =>
      response([
        {
          geometry: { type: 'Point', coordinates: [-75.2, 4.45] },
          properties: { MMC_SYMB: 'Au, Depositos de placer' },
        },
      ]),
    occurrencesUrl: 'https://example.test/occurrences',
    geologyUrl: 'https://example.test/geology',
    depositsUrl: 'https://example.test/deposits',
  });

  const result = await source.getEvidence({
    points: [{ lat: 4.45, lon: -75.2 }],
    center: { lat: 4.45, lon: -75.2 },
    commodity: 'copper',
  });

  assert.equal(result.values[0], 0);
  assert.equal(result.featureCount, 0);
});
