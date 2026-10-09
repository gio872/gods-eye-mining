import assert from 'node:assert/strict';
import {
  buildEvidenceSummary,
  distanceKm,
  generateGlobalTargets,
  generateProspectivityCandidates,
  TARGET_MODEL_ID,
} from './globalTargetEngine.js';

const bbox = {
  west: -75,
  south: 4,
  east: -72,
  north: 7,
};

const feature = (lon, lat, sourceId, mineral, status) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties: {
    sourceId,
    sourceName: sourceId,
    name: 'sample',
    mineral,
    status: status || 'Documented',
  },
});

{
  const targets = generateGlobalTargets(
    [
      feature(-73.01, 5.01, 'usgs-mrds', 'gold', 'Past Producer'),
      feature(-73.02, 5.02, 'usgs-critical-minerals', 'copper'),
      feature(-72.98, 5.04, 'usgs-mrds', 'gold'),
    ],
    bbox,
    { cellSize: 0.1 },
  );

  assert.equal(targets[0].modelId, TARGET_MODEL_ID);
  assert.ok(targets[0].score > 0);
  assert.match(targets[0].tier, /^TIER [1-4]$/);
  assert.equal(targets[0].sourceCount, 2);
  assert.ok(targets[0].evidence.commodityDiversity > 0);
  assert.equal(targets[0].rank, 1);
  assert.ok(targets[0].commodities.includes('gold'));
  assert.ok(targets[0].commodities.includes('copper'));
}

{
  const summary = buildEvidenceSummary(
    [
      feature(-73, 5, 'usgs-mrds', 'gold'),
      feature(-72.9, 5.1, 'usgs-critical-minerals', 'lithium'),
    ],
    [
      { score: 86, tier: 'TIER 1' },
      { score: 71, tier: 'TIER 2' },
    ],
  );

  assert.equal(summary.referenceFeatures, 2);
  assert.equal(summary.tier1, 1);
  assert.equal(summary.tier2, 1);
  assert.equal(summary.topScore, 86);
  assert.equal(summary.evidenceState, 'REFERENCE_DATA_ACTIVE');
}

{
  const distance = distanceKm(
    { latitude: 5, longitude: -73 },
    { latitude: 5, longitude: -73 },
  );
  assert.equal(distance, 0);
}


{
  const candidates = generateProspectivityCandidates(
    [
      feature(-74.95, 4.05, 'usgs-mrds', 'gold', 'Past Producer'),
    ],
    { west: -75, south: 4, east: -74, north: 5 },
    { cellSize: 0.25, maxCells: 16 },
  );

  assert.ok(candidates.length > 1);
  assert.ok(candidates.some((candidate) => candidate.referenceCount === 0));
  assert.ok(
    candidates.every(
      (candidate) =>
        candidate.id.startsWith('GEM-CAND-') &&
        candidate.candidate === true &&
        candidate.gridCellSize === 0.25,
    ),
  );
  assert.ok(
    candidates.some(
      (candidate) =>
        candidate.nearestReferenceKm == null &&
        candidate.score === 0,
    ),
  );
}
