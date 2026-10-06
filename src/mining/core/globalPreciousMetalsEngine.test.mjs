import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreDocumentedOccurrence, scoreProspectivePoint } from './globalPreciousMetalsEngine.js';

test('documented gold occurrence preserves known depth and produces a documented score',()=>{
  const row=scoreDocumentedOccurrence({
    id:'x',name:'Test Gold',latitude:1,longitude:2,commodity:'gold',
    developmentStatus:'Producer',depositType:'orogenic gold',grade:'5 g/t',
    depthTopM:120,depthBottomM:420,source:'test',
  });
  assert.equal(row.depthStatus,'known');
  assert.equal(row.depthM,420);
  assert.equal(row.commodity,'gold');
  assert.ok(row.score>0.8);
});

test('prospective screening exposes a low-confidence depth horizon rather than false precision',()=>{
  const row=scoreProspectivePoint({
    commodity:'gold',occurrenceProximity:0.8,occurrenceDensity:0.5,
    geologyScore:0.9,magneticScore:0.2,geologyText:'greenstone schist orogenic'
  });
  assert.ok(row.score>0.6);
  assert.equal(row.depthEstimate.system,'orogenic');
  assert.equal(row.depthEstimate.confidence,'low');
  assert.equal(row.uncertainty,'high');
});
