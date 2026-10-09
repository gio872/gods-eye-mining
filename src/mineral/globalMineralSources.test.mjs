import assert from 'node:assert/strict';
import {
  GLOBAL_MINERAL_SOURCES,
  fetchArcGISPoints,
  normalizeBBox,
  normalizeMineralFeatures,
} from './globalMineralSources.js';

const bbox = {
  west: -75,
  south: 4,
  east: -72,
  north: 7,
};

assert.deepEqual(normalizeBBox(bbox), bbox);

{
  const source = GLOBAL_MINERAL_SOURCES.mrds;
  const requested = [];

  const fetchImpl = async (url) => {
    requested.push(new URL(url));
    const offset = Number(url.searchParams.get('resultOffset') || 0);
    const count = offset === 0 ? 2 : 1;
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      async json() {
        return {
          features: Array.from({ length: count }, (_, index) => ({
            geometry: {
              type: 'Point',
              coordinates: [-73 + index / 100, 5 + index / 100],
            },
            properties: {
              gid: offset + index + 1,
              dep_id: 'D' + String(offset + index + 1),
              site_name: 'Test Site',
              dev_stat: 'Producer',
              code_list: 'Au',
              grade: 'A',
            },
          })),
        };
      },
    };
  };

  const rows = await fetchArcGISPoints(source, bbox, {
    fetchImpl,
    maxPages: 2,
    limit: 2,
  });

  assert.equal(rows.length, 3);
  assert.equal(requested.length, 2);
  assert.equal(requested[1].searchParams.get('resultOffset'), '2');
  assert.equal(
    requested[0].searchParams.get('outFields'),
    source.queryFields.join(','),
  );

  const features = normalizeMineralFeatures(rows, source);
  assert.equal(features.length, 3);
  assert.equal(features[0].properties.recordId, 'D1');
  assert.equal(features[0].properties.sourceId, source.id);
}

{
  const source = GLOBAL_MINERAL_SOURCES.criticalMinerals;
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    async json() {
      return {
        features: [
          {
            geometry: {
              type: 'Point',
              coordinates: [-70, 6],
            },
            properties: {
              gid: 77,
              dep_name: 'Critical Site',
              mineral: 'Lithium',
              dep_type: 'Pegmatite',
              latitude: 6,
              longitude: -70,
              location: 'South America',
            },
          },
        ],
      };
    },
  });

  const rows = await fetchArcGISPoints(source, bbox, { fetchImpl });
  const features = normalizeMineralFeatures(rows, source);
  assert.equal(features[0].properties.name, 'Critical Site');
  assert.equal(features[0].properties.mineral, 'Lithium');
}
