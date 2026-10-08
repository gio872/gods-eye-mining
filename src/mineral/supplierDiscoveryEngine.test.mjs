import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverSupplierCandidates, verifySupplierCandidate, compareSupplierCoverage } from './supplierDiscoveryEngine.js';

test('discovery ranks verified suppliers above incomplete candidates',()=>{
 const a={id:'a',name:'A',country:'Colombia',verificationStatus:'VERIFIED',sourceId:'usgs',sourceUrl:'x',sourceDate:'2026',commodities:['gold'],provenance:['x']};
 const b={id:'b',name:'B',country:'Colombia',verificationStatus:'UNVERIFIED',commodities:['gold']};
 const r=discoverSupplierCandidates([b,a],{commodity:'gold'});
 assert.equal(r[0].id,'a');
 assert.equal(verifySupplierCandidate(a).recommendedStatus,'VERIFIED');
 assert.equal(compareSupplierCoverage([a,b],['gold']).gold,2);
});
