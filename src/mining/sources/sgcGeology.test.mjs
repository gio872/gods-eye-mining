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

test('SGC source fuses geology, structures, drainage and Au/Ag/Cu anomalies', async () => {
  const calls = [];
  const source = createSgcGeologySource({
    fetchImpl: async (url) => {
      calls.push(url);
      if (url.includes('/1700/query'))
        return response([
          {
            geometry: { type: 'Point', coordinates: [-75.2, 4.45] },
            properties: {
              MMC_SIM_ST: 'Au, Deposito (productor o productor pasado)',
              ID_NOM_DEP: 'Test gold deposit',
            },
          },
        ]);
      if (url.includes('/1/query'))
        return response([
          {
            geometry: { type: 'Point', coordinates: [-75.205, 4.45] },
            properties: { MMC_SYMB: 'Au, ocurrencia' },
          },
        ]);
      if (url.includes('/1704/query'))
        return response([
          {
            geometry: {
              type: 'LineString',
              coordinates: [
                [-75.201, 4.44],
                [-75.201, 4.46],
              ],
            },
            properties: { Tipo_Estru: 'Falla' },
          },
        ]);
      if (url.includes('/1708/query'))
        return response([
          {
            geometry: {
              type: 'LineString',
              coordinates: [
                [-75.199, 4.44],
                [-75.199, 4.46],
              ],
            },
            properties: { Leyenda: 'Lineamiento magnético' },
          },
        ]);
      if (url.includes('/1709/query'))
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
      if (url.includes('/733/query'))
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
              Descripcion: 'Unidad volcanica y metamorfica',
            },
          },
        ]);
      if (url.includes('/728/query'))
        return response([
          {
            geometry: {
              type: 'LineString',
              coordinates: [
                [-75.202, 4.44],
                [-75.202, 4.46],
              ],
            },
            properties: { ESTADO_DRENAJE: '5101' },
          },
        ]);
      if (url.includes('/729/query'))
        return response([
          {
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [-75.203, 4.44],
                [-75.201, 4.44],
                [-75.201, 4.46],
                [-75.203, 4.46],
                [-75.203, 4.44],
              ]],
            },
            properties: {},
          },
        ]);
      if (url.includes('/identify?')) {
        const n = calls.filter((item) => item.includes('/identify?')).length;
        return {
          ok: true,
          async json() {
            const values = [
              [10, 5, 20],
              [20, 10, 40],
              [100, 50, 80],
            ][n] || [10, 5, 20];
            return {
              results: [
                { layerId: 3, value: String(values[0]) },
                { layerId: 0, value: String(values[1]) },
                { layerId: 13, value: String(values[2]) },
              ],
            };
          },
        };
      }
      throw new Error(`unexpected url: ${url}`);
    },
  });

  const points = [
    { id: 'a', lat: 4.45, lon: -75.20 },
    { id: 'b', lat: 4.451, lon: -75.201 },
    { id: 'c', lat: 4.452, lon: -75.202 },
  ];
  const result = await source.getEvidence({
    points,
    center: points[1],
    commodity: 'gold',
  });

  assert.equal(calls.length, 11);
  assert.equal(result.featureCount, 2);
  assert.equal(result.geologyMapFeatureCount, 1);
  assert.equal(result.lineamentFeatureCount, 1);
  assert.equal(result.drainageSimpleFeatureCount, 1);
  assert.equal(result.drainageDoubleFeatureCount, 1);
  assert.equal(result.geochemistrySampleCount, 3);
  assert.ok(result.lineamentValues[1] > 0);
  assert.ok(result.drainageValues[1] > 0);
  assert.ok(result.geochemistryValues[2] > result.geochemistryValues[0]);
  assert.ok(result.auAnomalyValues[2] > 0);
  assert.ok(result.agAnomalyValues[2] > 0);
  assert.ok(result.cuAnomalyValues[2] > 0);
  assert.match(result.source, /geoquímica Au\/Ag\/Cu/);
});
