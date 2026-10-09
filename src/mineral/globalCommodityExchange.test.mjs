import test from 'node:test';
import assert from 'node:assert/strict';
import { createCounterpartyProfile, createRFQ, createTradeContract, advanceSettlement, createLogisticsRecord, createTradeFinanceRequest, buildExchangeSnapshot } from './globalCommodityExchange.js';

test('exchange layer tracks RFQ, contract, settlement, logistics and trade finance',()=>{
 const cp=createCounterpartyProfile({id:'buyer',name:'Buyer A',country:'AE',verificationStatus:'VERIFIED'});
 const rfq=createRFQ({id:'rfq-1',buyerId:'buyer',commodity:'gold',quantity:10,unit:'kg',currency:'USD'});
 const contract=createTradeContract({id:'c-1',tradeId:'t-1',sellerId:'seller',buyerId:'buyer',commodity:'gold'});
 const settlement=advanceSettlement(advanceSettlement({stage:'FUNDED'},'DOCUMENTS_VERIFIED'),'SETTLED');
 const logistics=createLogisticsRecord({id:'l-1',tradeId:'t-1',status:'BOOKED'});
 const finance=createTradeFinanceRequest({id:'f-1',tradeId:'t-1',applicantId:'buyer',amount:500000,currency:'USD'});
 const snapshot=buildExchangeSnapshot({counterparties:[cp],rfqs:[rfq],contracts:[contract],settlements:[settlement],logistics:[logistics],financeRequests:[finance]});
 assert.equal(snapshot.verifiedCounterparties,1);
 assert.equal(snapshot.settledTrades,1);
 assert.equal(snapshot.fundedTrades,1);
});
