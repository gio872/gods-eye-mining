import test from 'node:test';
import assert from 'node:assert/strict';
import { createGlobalKnowledgeGraph, addGlobalSupplyRelationship, findCriticalDependencies, findByproductChains } from './globalMineralKnowledgeGraph.js';

test('global KG connects country, refinery and mineral with provenance',()=>{
 const g=createGlobalKnowledgeGraph();
 addGlobalSupplyRelationship(g,{fromType:'country',from:'A',toType:'refinery',to:'R',relation:'REFINES',mineral:'copper',share:.9,sourceId:'usgs'});
 addGlobalSupplyRelationship(g,{fromType:'mineral',from:'gallium',toType:'mineral',to:'zinc',relation:'BYPRODUCT_OF',sourceId:'iea'});
 const x=g.toJSON();
 assert.equal(x.nodes.length,3);
 assert.equal(findCriticalDependencies(x).length,1);
 assert.equal(findByproductChains(x).length,1);
 assert.equal(x.edges[0].sourceId,'usgs');
});
