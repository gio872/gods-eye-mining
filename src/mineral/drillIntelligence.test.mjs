import test from 'node:test';
import assert from 'node:assert/strict';
import {generateDrillHypotheses,selectDrillDecision} from './drillIntelligence.js';

test('structural evidence generates opposing drill hypotheses',()=>{
 const h=generateDrillHypotheses({id:'T1',score:82},{
  geology:85,geochemistry:80,spectral:78,geophysics:88,
  structure:{strike:30,dipDirection:120,dip:60,depthMinM:100,depthMaxM:350}
 });
 assert.equal(h.length,2);
 assert.equal(h[0].azimuth,120);
 assert.equal(h[0].targetDepthMinM,100);
 assert.equal(h[0].targetDepthMaxM,350);
});

test('missing structure does not invent an azimuth',()=>{
 const h=generateDrillHypotheses({id:'T2',score:75},{geology:80,geochemistry:75});
 assert.equal(h[0].azimuth,null);
 assert.equal(h[0].status,'INSUFFICIENT_ORIENTATION');
});

test('high multi-source target can become drill candidate',()=>{
 const d=selectDrillDecision({id:'T3',score:85,confidence:80},{
  geology:90,geophysics:85,geochemistry:88,spectral:86,structure:{strike:20,dipDirection:110}
 });
 assert.equal(d.decisionState,'DRILL_CANDIDATE');
});

test('weak evidence cannot authorize drilling',()=>{
 const d=selectDrillDecision({id:'T4',score:45,confidence:20},{geology:60,geochemistry:55});
 assert.equal(d.decisionState,'DO_NOT_DRILL');
});
