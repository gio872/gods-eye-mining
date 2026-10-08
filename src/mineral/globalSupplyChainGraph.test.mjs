import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupplyChainEdge, buildSupplyChainGraph, findSupplyChainBottlenecks } from './globalSupplyChainGraph.js';

test('supply chain graph retains provenance',()=>{
 const e=createSupplyChainEdge({mineral:'graphite',from:'Country A',to:'Country B',stage:'REFINING',share:.91,source:'official'});
 const g=buildSupplyChainGraph([e]);
 assert.equal(g.nodeCount,2); assert.equal(g.edgeCount,1);
 assert.equal(findSupplyChainBottlenecks([e])[0].reason,'HIGH_CHAIN_CONCENTRATION');
 assert.equal(e.source,'official');
});
