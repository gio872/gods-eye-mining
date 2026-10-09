import test from 'node:test';
import assert from 'node:assert/strict';
import { createCapitalProvider, matchCapitalProviders, buildCapitalCoverage } from './globalCapitalNetwork.js';

test('capital network supports banks, fintech and investment providers',()=>{
 const bank=createCapitalProvider({id:'b1',name:'Bank A',country:'UAE',type:'COMMERCIAL_BANK',commodities:['gold'],instruments:['PROJECT_FINANCE','TRADE_FINANCE'],verificationStatus:'VERIFIED'});
 const fintech=createCapitalProvider({id:'f1',name:'Fintech A',country:'UK',type:'FINTECH',commodities:['copper'],instruments:['WORKING_CAPITAL']});
 assert.equal(matchCapitalProviders([bank,fintech],{instrument:'PROJECT_FINANCE'}).length,1);
 assert.equal(buildCapitalCoverage([bank,fintech]).providerCount,2);
});
