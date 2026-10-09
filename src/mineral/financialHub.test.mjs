import test from 'node:test';
import assert from 'node:assert/strict';
import {createTreasuryBalance,createLedgerEntry,reconcileLedgerEntry,createPayoutRequest,applyComplianceDecision,buildFinancialHubSnapshot} from './financialHub.js';

test('financial hub tracks balances, ledger, payout compliance and reconciliation',()=>{
 const balance=createTreasuryBalance({accountId:'a1',currency:'USD',available:100000});
 const entry=createLedgerEntry({id:'e1',accountId:'a1',type:'CREDIT',amount:5000,currency:'USD'});
 const matched=reconcileLedgerEntry(entry,{reference:'bank-1',amount:5000,currency:'USD'});
 assert.equal(matched.reconciliationStatus,'MATCHED');
 const payout=applyComplianceDecision(createPayoutRequest({id:'p1',accountId:'a1',destination:'beneficiary',currency:'USDC',amount:1000}),'PASSED',['kyc','aml','sanctions']);
 assert.equal(payout.status,'READY_FOR_PROVIDER');
 const snapshot=buildFinancialHubSnapshot({balances:[balance],ledger:[matched],payouts:[payout],reconciliation:[{status:'MATCHED'}]});
 assert.equal(snapshot.balancesByCurrency.USD,100000);
 assert.equal(snapshot.complianceHolds,0);
});
