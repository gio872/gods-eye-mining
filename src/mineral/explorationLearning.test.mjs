import test from 'node:test';
import assert from 'node:assert/strict';
import { createExplorationOutcome, applyLearningSignals } from './explorationLearning.js';

test('GEM records validated drill evidence without inventing economics', () => {
  const outcome = createExplorationOutcome({targetId:'T-1',runId:'R-1',outcomeType:'DRILL',validationStatus:'VALIDATED',assays:[{element:'Cu',value:1.2}],provenance:['lab-1']});
  const [target] = applyLearningSignals([{id:'T-1',score:82}], [outcome]);
  assert.equal(target.learning.confirmed, true);
  assert.equal(target.learning.validatedOutcomeCount, 1);
  assert.equal(target.resource, undefined);
  assert.equal(target.reserve, undefined);
});

test('GEM preserves pending evidence as pending', () => {
  const outcome = createExplorationOutcome({targetId:'T-2',runId:'R-2',outcomeType:'FIELD_VALIDATION'});
  const [target] = applyLearningSignals([{id:'T-2'}], [outcome]);
  assert.equal(target.learning.confirmed, false);
  assert.equal(target.learning.outcomeCount, 1);
});