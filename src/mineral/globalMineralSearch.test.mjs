import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MINERAL_SEARCH_CATALOG,
  attachRequestedCommodity,
  featureMatchesMineral,
  filterMineralFeatures,
  filterTargetsToCountry,
  listMineralSearchCountries,
  normalizeMineralKey,
  resolveMineralSearch,
} from './globalMineralSearch.js';

test('normalizes metal aliases', () => {
  assert.equal(normalizeMineralKey('oro'), 'gold');
  assert.equal(normalizeMineralKey('Au'), 'gold');
  assert.equal(normalizeMineralKey('wolframio'), 'tungsten');
  assert.equal(normalizeMineralKey('REE'), 'rareearth');
  assert.equal(normalizeMineralKey('plata'), 'silver');
});

test('catalog exposes global mineral and metal choices', () => {
  assert.ok(MINERAL_SEARCH_CATALOG.some((entry) => entry.key === 'gold'));
  assert.ok(MINERAL_SEARCH_CATALOG.some((entry) => entry.key === 'tungsten'));
  assert.ok(MINERAL_SEARCH_CATALOG.some((entry) => entry.key === 'rareearth'));
});

test('filters reference features by requested commodity', () => {
  const gold = {
    geometry: { type: 'Point', coordinates: [-75, 4] },
    properties: { mineral: 'Gold', name: 'Gold occurrence' },
  };
  const copper = {
    geometry: { type: 'Point', coordinates: [-74, 5] },
    properties: { mineral: 'Copper', name: 'Copper occurrence' },
  };
  assert.equal(featureMatchesMineral(gold, 'gold'), true);
  assert.equal(featureMatchesMineral(copper, 'gold'), false);
  assert.equal(filterMineralFeatures([gold, copper], 'gold').length, 1);
});

test('resolves Colombia from the bundled country boundaries', async () => {
  const result = await resolveMineralSearch({
    country: 'Colombia',
    mineral: 'Gold',
  });
  assert.equal(result.countryName, 'Colombia');
  assert.equal(result.mineralKey, 'gold');
  assert.ok(result.country);
  assert.ok(result.country.polygons.length > 0);
  assert.ok(result.bbox.west < result.bbox.east);
});

test('country filter keeps target centers inside the selected polygon', async () => {
  const result = await resolveMineralSearch({ country: 'Colombia' });
  const inside = {
    id: 'inside',
    latitude: 4.6,
    longitude: -74.1,
  };
  const outside = {
    id: 'outside',
    latitude: -33.4,
    longitude: -70.6,
  };
  const filtered = filterTargetsToCountry([inside, outside], result.country);
  assert.deepEqual(
    filtered.map((target) => target.id),
    ['inside'],
  );
});

test('selected commodity is carried into prospectivity targets', () => {
  const target = attachRequestedCommodity(
    { id: 'GEM-CAND-1', commodities: ['Copper'] },
    'gold',
  );
  assert.equal(target.requestedCommodity, 'gold');
  assert.deepEqual(target.commodities, ['gold']);
});

test('country catalog is nonempty and deterministic', async () => {
  const countries = await listMineralSearchCountries();
  assert.ok(countries.length > 100);
  for (let i = 1; i < countries.length; i += 1)
    assert.ok(
      countries[i - 1].name.localeCompare(countries[i].name) <= 0,
    );
});
