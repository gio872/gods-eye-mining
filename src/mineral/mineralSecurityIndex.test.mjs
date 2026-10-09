import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMineralSecurityIndex, rankSecurityGaps } from './mineralSecurityIndex.js';

test('security index is deterministic and bounded',()=>{
 const a=buildMineralSecurityIndex({country:'X',mineral:'copper',indicators:{
  importDependence:1,miningConcentration:.8,refiningConcentration:.9,tradeExposure:.7,
  projectPipeline:0,domesticCoverage:0,geologicalPotential:0,recycling:0,infrastructure:0,dataConfidence:1
 }});
 assert.ok(a.vulnerabilityIndex>=0 && a.vulnerabilityIndex<=100);
 assert.equal(a.interpretation,'indicator_only');
 assert.ok(Array.isArray(a.provenance));
});
test('security gaps rank by vulnerability',()=>{
 const a=buildMineralSecurityIndex({country:'A',mineral:'x',indicators:{importDependence:1}});
 const b=buildMineralSecurityIndex({country:'B',mineral:'x',indicators:{importDependence:.1}});
 const r=rankSecurityGaps([b,a]);
 assert.equal(r[0].country,'A');
 assert.equal(r[0].securityGapRank,1);
});
