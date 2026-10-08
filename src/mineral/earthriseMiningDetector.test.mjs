import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EARTHRISE_MINING_SOURCE,
  earthriseCoverageForPoint,
  earthriseMiningEvidence,
  parseEarthriseDetections,
} from './earthriseMiningDetector.js';

test('parses Earthrise detections and preserves temporal status', () => {
  const detections = parseEarthriseDetections({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-72, 3] },
        properties: {
          confidence: 0.91,
          onset_year: 2022,
          status: 'confirmed',
        },
      },
    ],
  });
  assert.equal(detections.length, 1);
  assert.equal(detections[0].confirmed, true);
  assert.equal(detections[0].onsetYear, 2022);
});

test('returns local activity evidence without turning no nearby detections into zero evidence', () => {
  const detections = parseEarthriseDetections({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-72, 3] },
        properties: { confidence: 0.9, status: 'confirmed', onset_year: 2023 },
      },
    ],
  });
  const evidence = earthriseMiningEvidence(
    { latitude: 3, longitude: -72 },
    detections,
  );
  assert.ok(evidence.score > 0);
  assert.equal(evidence.confirmedCount, 1);
});

test('Earthrise coverage is not implied globally', () => {
  assert.equal(earthriseCoverageForPoint(3, -72), 'covered');
  assert.equal(earthriseCoverageForPoint(40, -74), 'not_covered');
  assert.equal(EARTHRISE_MINING_SOURCE.license, 'CC-BY-4.0');
});
