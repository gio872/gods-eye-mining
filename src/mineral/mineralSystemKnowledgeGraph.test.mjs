import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMineralSystemGraph,graphSupportSummary} from './mineralSystemKnowledgeGraph.js';

test('builds a mineral-system evidence graph',()=>{
 const graph=buildMineralSystemGraph({id:'T1',latitude:1,longitude:2},{commodity:'gold',geology:'felsic',structure:'fault',spectral:'clay',geochemistry:'Au-As',geophysics:'magnetic'});
 assert.ok(graph.nodes.length>=6);
 assert.ok(graph.edges.length>=6);
 assert.equal(graph.nodes.some(n=>n.type==='target'),true);
});

test('graph support summary is bounded',()=>{
 const graph={edges:[
  {relation:'SUPPORTED_BY',target:'geochemistry:x'},
  {relation:'HOSTED_BY',target:'lithology:y'},
  {relation:'CONTROLLED_BY',target:'structure:z'},
 ]};
 const summary=graphSupportSummary(graph);
 assert.equal(summary.independentEvidenceTypes,3);
 assert.ok(summary.coherence>=0&&summary.coherence<=100);
});
