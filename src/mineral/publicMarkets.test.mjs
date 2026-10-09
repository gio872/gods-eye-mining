import test from 'node:test';
import assert from 'node:assert/strict';
import {createShareholder,buildCapTable,createListingReadiness,createEquityRound,buildInvestorMarketSnapshot} from './publicMarkets.js';

test('public markets layer models cap table and listing readiness without claiming approval',()=>{
 const cap=buildCapTable([
  createShareholder({id:'A',name:'Founder',shares:700}),
  createShareholder({id:'B',name:'Investor',shares:300})
 ],{authorizedShares:2000});
 const readiness=createListingReadiness({stage:'PRE_IPO',legalEntity:true,capTable:true,boardGovernance:true});
 const round=createEquityRound({id:'R1',securityType:'COMMON_SHARE',amountTarget:5000000,status:'PLANNED'});
 const snap=buildInvestorMarketSnapshot({capTable:cap,readiness,rounds:[round]});
 assert.equal(cap.issuedShares,1000);
 assert.equal(cap.shareholders[0].ownershipPercent,.7);
 assert.equal(readiness.stage,'PRE_IPO');
 assert.equal(round.securityType,'COMMON_SHARE');
 assert.equal(snap.plannedRounds,1);
});
