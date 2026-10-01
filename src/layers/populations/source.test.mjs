import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePopulationFeature,
  populationClassAllowedAtZoom,
  populationZoomForCameraHeight,
} from './source.js';

test('population zoom increases as the camera approaches the ground', () => {
  assert.ok(
    populationZoomForCameraHeight(500_000) >
      populationZoomForCameraHeight(5_000_000),
  );
  assert.equal(populationZoomForCameraHeight(20_000), 14);
  assert.equal(populationZoomForCameraHeight(40_000_000), 4);
});

test('settlement classes appear progressively with zoom detail', () => {
  assert.equal(populationClassAllowedAtZoom('city', 5), true);
  assert.equal(populationClassAllowedAtZoom('town', 6), false);
  assert.equal(populationClassAllowedAtZoom('town', 7), true);
  assert.equal(populationClassAllowedAtZoom('village', 8), false);
  assert.equal(populationClassAllowedAtZoom('village', 9), true);
  assert.equal(populationClassAllowedAtZoom('hamlet', 10), false);
  assert.equal(populationClassAllowedAtZoom('hamlet', 11), true);
});

test('normalization preserves names and documented rank importance', () => {
  const city = normalizePopulationFeature(
    {
      id: 123,
      geometry: { type: 'Point', coordinates: [-75.244, 4.438] },
      properties: {
        class: 'city',
        name: 'Ibagué',
        rank: 5,
        capital: '6',
      },
    },
    { zoom: 10 },
  );
  assert.equal(city.name, 'Ibagué');
  assert.equal(city.placeClass, 'city');
  assert.equal(city.rank, 5);
  assert.equal(city.capital, '6');
  assert.ok(city.priority > 1000);
});

test('invalid, unnamed, and too-distant settlements are rejected', () => {
  assert.equal(
    normalizePopulationFeature({
      geometry: { type: 'Point', coordinates: ['x', 4] },
      properties: { class: 'city', name: 'Broken' },
    }),
    null,
  );
  assert.equal(
    normalizePopulationFeature(
      {
        geometry: { type: 'Point', coordinates: [-75, 4] },
        properties: { class: 'hamlet', name: '' },
      },
      { zoom: 11 },
    ),
    null,
  );
  assert.equal(
    normalizePopulationFeature(
      {
        geometry: { type: 'Point', coordinates: [-75, 4] },
        properties: { class: 'village', name: 'Far away' },
      },
      { zoom: 8 },
    ),
    null,
  );
});
