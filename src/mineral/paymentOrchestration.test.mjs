import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaymentIntent, quoteFx, authorizePayment, selectPaymentRoute, createProviderProfile } from './paymentOrchestration.js';

test('GEM payment orchestration supports fiat, FX and stablecoin routing',()=>{
 const p=createPaymentIntent({id:'p1',amount:1000,sourceCurrency:'USD',destinationCurrency:'USDC',sourceRail:'BANK_TRANSFER',destinationRail:'STABLECOIN'});
 assert.equal(p.assetType,'DIGITAL_ASSET');
 const q=quoteFx({from:'USD',to:'EUR',amount:1000,rate:.92,fee:5});
 assert.equal(q.netDestinationAmount,915);
 const a=authorizePayment(p,{kyc:true,aml:true,sanctions:true});
 assert.equal(a.status,'AUTHORIZED');
 const provider=createProviderProfile({id:'circle',name:'Circle',type:'CIRCLE',currencies:['USD','EUR','USDC'],rails:['BANK_TRANSFER','STABLECOIN'],digitalAssets:['USDC']});
 assert.equal(selectPaymentRoute({sourceCurrency:'USD',destinationCurrency:'USDC',sourceRail:'BANK_TRANSFER',destinationRail:'STABLECOIN',providers:[provider]}).length,1);
});
