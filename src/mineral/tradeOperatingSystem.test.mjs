import test from 'node:test';
import assert from 'node:assert/strict';
import { createTradeWorkspace, advanceTradeStage, createTradeDocument, buildTradeOperationsDashboard } from './tradeOperatingSystem.js';

test('trade OS manages pipeline and revenue',()=>{
 let w=createTradeWorkspace({id:'w1',tradeId:'t1',commodity:'gold',notional:1000000});
 w=advanceTradeStage(w,'RFQ');
 w=advanceTradeStage(w,'MATCHED');
 const doc=createTradeDocument({id:'d1',tradeId:'t1',type:'CONTRACT',status:'VERIFIED'});
 const d=buildTradeOperationsDashboard({
  workspaces:[w],documents:[doc],trades:[{stage:'COMPLETED',notional:1000000}],
  commissions:[{commission:5000,currency:'USD'}],subscriptions:[{amount:299,currency:'USD'}]
 });
 assert.equal(d.activeTrades,1);
 assert.equal(d.verifiedDocuments,1);
 assert.equal(d.revenue.totalPlatformRevenue,5299);
});
