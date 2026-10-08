import assert from 'node:assert/strict';
import {
  TRUE_PROSPECTIVITY_MODEL_ID,
  computeTrueEvidence,
  geologyScore,
} from './trueProspectivity.js';

const target = {
  score: 50,
  commodities: ['gold'],
  nearestReference: 'gold prospect',
  longitude: -73,
  latitude: 5,
};

{
  assert.equal(
    geologyScore('Metamorphic rocks', target),
    95,
  );
  assert.equal(
    geologyScore('Water Bodies', target),
    null,
  );
}

{
  const result = computeTrueEvidence(target, {
    geology: { score: 95, lithology: 'Metamorphic rocks' },
    magnetics: {
      geophysics: 88,
      structure: 70,
      anomalyNt: 420,
      localRangeNt: 300,
    },
    terrain: { terrain: 60, elevationM: 1200, localReliefM: 220 },
  });

  assert.equal(result.modelId, TRUE_PROSPECTIVITY_MODEL_ID);
  assert.equal(result.mode, 'MULTIMODAL_FUSION');
  assert.ok(result.score > 70);
  assert.equal(result.coverage, 100);
  assert.ok(result.confidence > 60);
  assert.deepEqual(
    Object.keys(result.channels).sort(),
    ['geology', 'geophysics', 'structure'],
  );
  assert.equal(result.diagnostics.terrain.localReliefM, 220);
}
