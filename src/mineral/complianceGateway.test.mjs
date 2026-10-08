import test from 'node:test';
import assert from 'node:assert/strict';
import {createComplianceCase,recordComplianceCheck,evaluateComplianceCase,authorizeTransaction} from './complianceGateway.js';

test('compliance gateway blocks incomplete and authorizes fully passed case',()=>{
 let c=createComplianceCase({id:'c1',subjectId:'co1',subjectType:'COMPANY',jurisdiction:'AE'});
 for(const k of ['KYC','KYB','AML','KYT','SANCTIONS','TRAVEL_RULE','JURISDICTION','LIMITS'])
  c=recordComplianceCheck(c,k,{state:'PASS',providerId:'provider-1',reference:k+'-1'});
 c=evaluateComplianceCase(c);
 assert.equal(c.decision,'PASS');
 assert.equal(authorizeTransaction(c,{id:'p1',amount:1000},{maxTransactionAmount:5000}).authorized,true);
 assert.equal(authorizeTransaction(c,{id:'p2',amount:10000},{maxTransactionAmount:5000}).authorized,false);
});
