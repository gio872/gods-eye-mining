import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPlanetaryCoordinate,
  formatPlanetaryDistance,
  getAvailablePlanetaryStacks,
  normalizePlanetarySearchQuery,
} from './gemPlanetSurface.js';

test('planetary cursor coordinates use signed hemispheres', () => {
  assert.equal(formatPlanetaryCoordinate(4.6231, -72.1885), '4.6231° N · 72.1885° W');
  assert.equal(formatPlanetaryCoordinate(-4.6231, 72.1885), '4.6231° S · 72.1885° E');
  assert.equal(formatPlanetaryCoordinate(Number.NaN, 0), '—');
});

test('planetary distance readout changes units without hiding short distances', () => {
  assert.equal(formatPlanetaryDistance(47), '47 m');
  assert.equal(formatPlanetaryDistance(1000), '1.00 km');
  assert.equal(formatPlanetaryDistance(123456), '123.5 km');
  assert.equal(formatPlanetaryDistance(-1), '—');
});

test('basemap list reflects provider availability and restrictions', () => {
  const stacks = getAvailablePlanetaryStacks({
    getStacks: () => [
      { id: 'esri-imagery', label: 'Esri Satellite', available: true },
      { id: 'bing-aerial', label: 'Bing Aerial', available: false, unavailableReason: 'Cesium Ion token required', requiresIon: true },
    ],
  });
  assert.deepEqual(stacks, [
    { id: 'esri-imagery', label: 'Esri Satellite', available: true, unavailableReason: null, requiresIon: false },
    { id: 'bing-aerial', label: 'Bing Aerial', available: false, unavailableReason: 'Cesium Ion token required', requiresIon: true },
  ]);
  assert.deepEqual(getAvailablePlanetaryStacks(null), []);
});

test('planetary search trims and bounds country, place and coordinate queries', () => {
  assert.equal(normalizePlanetarySearchQuery('  Colombia  '), 'Colombia');
  assert.equal(normalizePlanetarySearchQuery('4.6231, -72.1885'), '4.6231, -72.1885');
  assert.equal(normalizePlanetarySearchQuery('   '), '');
  assert.equal(normalizePlanetarySearchQuery('x'.repeat(260)).length, 240);
});
