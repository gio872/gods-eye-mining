import test from 'node:test';
import assert from 'node:assert/strict';
import {
  build3DResourceFeatures,
  buildResourceEvidence,
  buildSubsurfaceResourceIndex,
  createSubsurfaceResourceRecord,
  normalizeCommodity,
  normalizeCoordinates,
  normalizeDepthInterval,
  querySubsurfaceResources,
  summarizeSubsurfaceResources,
} from './subsurfaceResourceIntelligence.js';

test('normalizes commodities and coordinates', () => {
  assert.equal(normalizeCommodity('petróleo'), 'petroleum');
  assert.equal(normalizeCommodity('Au'), 'gold');
  assert.deepEqual(normalizeCoordinates(4.44, -75.23), { latitude: 4.44, longitude: -75.23 });
  assert.equal(normalizeCoordinates(91, 0), null);
});

test('creates a depth-resolved drill record', () => {
  const record = createSubsurfaceResourceRecord({
    id: 'BH-001-AU',
    family: 'METAL',
    commodity: 'Au',
    latitude: 4.44,
    longitude: -75.23,
    topDepth: 120,
    bottomDepth: 155,
    depthDatum: 'GROUND',
    depthType: 'TRUE_VERTICAL_DEPTH',
    drillholeId: 'BH-001',
    evidenceClass: 'DRILLED',
    confidence: 96,
    source: { id: 'SURVEY-01', name: 'National Geological Survey' },
  });

  assert.equal(record.commodity, 'gold');
  assert.equal(record.depth.midpoint, 137.5);
  assert.equal(record.depth.thickness, 35);
  assert.equal(record.evidenceClass, 'DRILLED');
  assert.equal(record.source.id, 'SURVEY-01');
});

test('indexes and queries by commodity and depth', () => {
  const records = [
    createSubsurfaceResourceRecord({
      id: 'AU-1', commodity: 'gold', latitude: 4.44, longitude: -75.23,
      depth: 200, depthDatum: 'GROUND', evidenceClass: 'MEASURED', confidence: 95,
    }),
    createSubsurfaceResourceRecord({
      id: 'OIL-1', commodity: 'petroleum', latitude: 4.60, longitude: -75.40,
      depth: 1800, depthDatum: 'MSL', evidenceClass: 'DRILLED', confidence: 92,
    }),
  ];
  const index = buildSubsurfaceResourceIndex(records);
  const hits = querySubsurfaceResources(index, {
    latitude: 4.44, longitude: -75.23, radiusKm: 5,
    commodity: 'Au', minDepth: 100, maxDepth: 300,
  });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].id, 'AU-1');
});

test('builds 3D features and preserves evidence provenance', () => {
  const record = createSubsurfaceResourceRecord({
    id: 'WELL-OIL-1', family: 'PETROLEUM', commodity: 'oil',
    latitude: 10, longitude: -70, depth: 2450, depthDatum: 'MSL',
    wellId: 'W-1', evidenceClass: 'DRILLED',
    source: { id: 'PET-REG', name: 'Petroleum Registry', version: '2026' },
  });
  const features = build3DResourceFeatures([record]);
  assert.equal(features[0].geometry.coordinates[2], -2450);
  assert.equal(features[0].properties.sourceId, 'PET-REG');
});

test('builds target evidence without promoting inference to reserve', () => {
  const record = createSubsurfaceResourceRecord({
    id: 'HYP-1', commodity: 'copper', latitude: 1, longitude: 1,
    depth: 900, depthDatum: 'GROUND', evidenceClass: 'GEOPHYSICAL_INFERENCE',
    confidence: 65,
  });
  const evidence = buildResourceEvidence(
    { latitude: 1, longitude: 1, requestedCommodity: 'copper' },
    [record],
    2,
  );
  assert.equal(evidence.available, true);
  assert.equal(evidence.evidenceClass, 'INFERENCE');
  assert.match(evidence.interpretation, /not a mineral resource/i);
});

test('summarizes depth-resolved resources', () => {
  const record = createSubsurfaceResourceRecord({
    id: 'M-1', commodity: 'gold', latitude: 0, longitude: 0,
    topDepth: 50, bottomDepth: 100, depthDatum: 'GROUND',
    evidenceClass: 'MEASURED',
  });
  const summary = summarizeSubsurfaceResources([record]);
  assert.equal(summary.total, 1);
  assert.equal(summary.withDepth, 1);
  assert.deepEqual(summary.depthRangeM, { min: 50, max: 100 });
});
