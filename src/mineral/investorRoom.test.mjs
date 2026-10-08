import test from 'node:test';
import assert from 'node:assert/strict';
import {buildScenarioSet,simulateDilution,buildUseOfFunds,buildIPOPath,buildInvestorRoomSnapshot} from './investorRoom.js';

test('investor room produces three scenarios and five-year projections',()=>{
 const s=buildScenarioSet();
 assert.deepEqual(Object.keys(s),['CONSERVATIVE','BASE','UPSIDE']);
 assert.equal(s.BASE.years.length,5);
 assert.ok(s.UPSIDE.years.at(-1).revenue>s.CONSERVATIVE.years.at(-1).revenue);
});
test('dilution is mathematically explicit',()=>{
 const d=simulateDilution({preMoneyValuation:10_000_000,raiseAmount:2_500_000});
 assert.equal(d.postMoneyValuation,12_500_000);
 assert.equal(d.newInvestorOwnership,.2);
});
test('use of funds must reconcile',()=>{
 const u=buildUseOfFunds({totalRaise:10_000_000});
 const total=Object.values(u.allocation).reduce((s,x)=>s+x.amount,0);
 assert.equal(total,10_000_000);
});
test('snapshot contains IPO path and non-guarantee disclosure',()=>{
 const x=buildInvestorRoomSnapshot({dilution:{preMoneyValuation:20_000_000,raiseAmount:5_000_000}});
 assert.equal(x.ipoPath.length,6);
 assert.equal(x.assumptionsOnly,true);
});
