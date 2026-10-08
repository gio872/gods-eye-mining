import assert from 'node:assert/strict';
import { EVIDENCE_CHANNELS, fuseEvidence } from './evidenceFusion.js';

{
  const result = fuseEvidence(80);
  assert.equal(result.mode, 'REFERENCE_ONLY');
  assert.equal(result.score, 80);
  assert.ok(result.coverage > 0);
  assert.deepEqual(result.availableChannels, ['reference']);
}

{
  const result = fuseEvidence(
    80,
    { geology: 60, geophysics: 90, spectral: 100 },
  );
  assert.equal(result.mode, 'MULTIMODAL_FUSION');
  assert.ok(result.score > 80);
  assert.equal(
    Math.round(result.coverage * 10) / 10,
    70.0,
  );
  assert.equal(result.availableChannels.length, 4);
}

{
  const result = fuseEvidence(70, { geology: null, geophysics: 'bad' });
  assert.equal(result.score, 70);
  assert.equal(result.availableChannels.length, 1);
}

assert.equal(
  Object.values(EVIDENCE_CHANNELS).reduce((sum, value) => sum + value, 0),
  1,
);
