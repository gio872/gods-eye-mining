import test from 'node:test';
import assert from 'node:assert/strict';
import { createRefineryRecord, findRefineries, buildRefineryCapacityMap } from './globalRefineryRegistry.js';
import { createFinancialEvent, buildFinancialTrace, summarizeCommodityFlows } from './financialTraceability.js';

test('refinery registry supports metal and petroleum facilities',()=>{
 const a=createRefineryRecord({id:'r1',name:'Metal Refinery',country:'Colombia',family:'PRECIOUS_METAL',type:'REFINERY',commodities:['gold'],sourceId:'official'});
 const b=createRefineryRecord({id:'r2',name:'Oil Refinery',country:'Colombia',family:'PETROLEUM',type:'OIL_REFINERY',commodities:['crude oil'],sourceId:'official'});
 assert.equal(findRefineries([a,b],{family:'PETROLEUM'}).length,1);
 assert.equal(buildRefineryCapacityMap([a,b]).gold.length,1);
});
test('financial trace preserves source and privacy class',()=>{
 const e=createFinancialEvent({id:'f1',type:'TRADE',date:'2026-01-01',currency:'USD',amount:1000000,commodity:'gold',sender:'A',receiver:'B',sourceId:'customs'});
 const t=buildFinancialTrace([e]);
 assert.equal(t.eventCount,1); assert.equal(t.links[0].sourceId,'customs');
 assert.equal(summarizeCommodityFlows([e],'gold').totalNotional,1000000);
});
