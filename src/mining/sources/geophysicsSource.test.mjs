import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGeophysicalText } from './geophysicsSource.js';
import { createGeophysicsEngine } from '../core/geophysicsEngine.js';

test('parses whitespace-delimited XYZ with depth and conductivity', () => {
  const rows = parseGeophysicalText(
    'id x y z depth mineral confidence\nA -70.1 5.2 10.5 60 gold 0.9\nB -70.2 5.3 4.0 120 gold 0.8',
    'campaign.xyz',
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].longitude, -70.1);
  assert.equal(rows[0].latitude, 5.2);
  assert.equal(rows[0].depthM, 60);
  assert.equal(rows[0].value, 10.5);
  assert.equal(rows[0].mineral, 'gold');
});

test('ranks high-intensity subsurface observations above low-intensity observations', () => {
  const engine = createGeophysicsEngine();
  const ranked = engine.rank([
    { id:'low', latitude:5, longitude:-70, depthM:80, intensity:1, confidence:0.9, mineral:'gold' },
    { id:'high', latitude:5.1, longitude:-70.1, depthM:80, intensity:10, confidence:0.9, mineral:'gold' },
  ]);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].id, 'gem-subsurface-target-high');
  assert.ok(ranked[0].score > ranked[1].score);
});

test('GeoJSON parser accepts point z as depth', () => {
  const rows = parseGeophysicalText(JSON.stringify({
    type:'FeatureCollection',
    features:[{
      type:'Feature',
      properties:{ mineral:'copper', intensity:7, confidence:0.7 },
      geometry:{ type:'Point', coordinates:[-72.2,4.4,150] },
    }],
  }), 'survey.geojson');
  assert.equal(rows[0].longitude, -72.2);
  assert.equal(rows[0].latitude, 4.4);
  assert.equal(rows[0].depthM, 150);
  assert.equal(rows[0].mineral, 'copper');
});
