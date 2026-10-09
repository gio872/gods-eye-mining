import assert from 'node:assert/strict';
import {
  TRUE_PROSPECTIVITY_MODEL_ID,
  computeTrueEvidence,
  geologyScore,
} from './trueProspectivity.js';
import {
  enmapSpectralScore,
  spectralAlterationScore,
} from './earthObservationEvidence.js';
import {
  extractGeochemistrySamples,
  geochemistryScore,
} from './geochemistry.js';

const target = {
  score: 50,
  commodities: ['gold'],
  nearestReference: 'gold prospect',
  longitude: -73,
  latitude: 5,
};

{
  assert.equal(geologyScore('Metamorphic rocks', target), 95);
  assert.equal(geologyScore('Water Bodies', target), null);
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
  assert.equal(result.coverage, 55);
  assert.ok(result.confidence > 45);
  assert.deepEqual(Object.keys(result.channels).sort(), [
    'geology',
    'geophysics',
    'structure',
  ]);
  assert.equal(result.diagnostics.terrain.localReliefM, 220);
}

{
  const spectral = spectralAlterationScore({
    blue: 900,
    red: 1500,
    nir: 1200,
    swir1: 1400,
    swir2: 1200,
  });
  assert.ok(spectral);
  assert.ok(spectral.score > 50);

  const enmap = enmapSpectralScore({
    blue: 900,
    red: 1500,
    nir: 1200,
    swir1: 1400,
    swir21: 1500,
    swir2: 1200,
    swir23: 1500,
  });
  assert.ok(enmap);
  assert.ok(enmap.clayAbsorption > 0);
}

{
  const features = [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-73, 5] },
      properties: { Au_ppm: 1, As_ppm: 20, Sb_ppm: 3, W_ppm: 4 },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-72.98, 5.01] },
      properties: { Au_ppm: 0.2, As_ppm: 5, Sb_ppm: 0.8, W_ppm: 1 },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-73.02, 4.99] },
      properties: { Au_ppm: 0.15, As_ppm: 4, Sb_ppm: 0.7, W_ppm: 0.8 },
    },
  ];
  const samples = extractGeochemistrySamples(features);
  assert.equal(samples.length, 3);
  assert.equal(samples[0].elements.s, undefined);
  assert.equal(samples[0].elements.sample, undefined);
  const result = geochemistryScore(
    { latitude: 5, longitude: -73, commodities: ['gold'] },
    samples,
  );
  assert.ok(result);
  assert.equal(result.commodity, 'gold');
  assert.ok(result.sampleCount >= 3);
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
    geochemistry: { score: 82, commodity: 'gold', sampleCount: 18 },
    spectral: {
      spectral: 79,
      activeProviders: ['Sentinel-2 L2A', 'EnMAP L2A'],
    },
  });

  assert.equal(result.modelId, TRUE_PROSPECTIVITY_MODEL_ID);
  assert.equal(result.coverage, 100);
  assert.deepEqual(Object.keys(result.channels).sort(), [
    'geochemistry',
    'geology',
    'geophysics',
    'spectral',
    'structure',
  ]);
  assert.ok(result.score > 75);
  assert.equal(result.drillDecision.engine.id, 'GEM-DRILL-INTELLIGENCE');
  assert.ok(Array.isArray(result.drillDecision.hypotheses));
  assert.equal(result.drillDecision.hypotheses[0].azimuth, null);
}
