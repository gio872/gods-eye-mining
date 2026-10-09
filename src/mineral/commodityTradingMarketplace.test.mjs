import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommodityListing, createTradeMatch, calculateCommission, calculateSubscriptionRevenue } from './commodityTradingMarketplace.js';

test('commodity marketplace matches physical gold and calculates commission',()=>{
 const offer=createCommodityListing({id:'o1',side:'OFFER',commodity:'gold',unit:'kg',quantity:100,unitPrice:100000,currency:'USD',participantId:'seller-1'});
 const bid=createCommodityListing({id:'b1',side:'BID',commodity:'gold',unit:'kg',quantity:60,unitPrice:98000,currency:'USD',participantId:'buyer-1'});
 const match=createTradeMatch(offer,bid,{unitPrice:99000});
 assert.equal(match.quantity,60);
 assert.equal(match.notional,5940000);
 assert.equal(calculateCommission(match.notional,50).commission,29700);
});
test('subscription revenue is recurring revenue, not trade revenue',()=>{
 assert.equal(calculateSubscriptionRevenue([{monthlyUsd:299},{monthlyUsd:2499}]).recurringRevenueUsd,2798);
});
