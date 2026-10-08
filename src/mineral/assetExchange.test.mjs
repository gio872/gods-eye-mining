import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssetMarketOrder,matchAssetMarketOrders,reserveAssetMatch,linkAssetTrade,buildAssetExchangeSnapshot} from './assetExchange.js';

test('asset exchange matches compatible physical asset intents without claiming settlement',()=>{
 const offer=createAssetMarketOrder({id:'O1',side:'OFFER',commodity:'GOLD',quantity:10,price:90000,currency:'USD',assetIds:['BAR-1'],minPurity:99});
 const bid=createAssetMarketOrder({id:'B1',side:'BID',commodity:'GOLD',quantity:8,price:91000,currency:'USD'});
 const matches=matchAssetMarketOrders([offer,bid]);
 assert.equal(matches.length,1);assert.equal(matches[0].quantity,8);assert.equal(matches[0].status,'MATCHED');
 const reserved=reserveAssetMatch(matches[0],{reservationId:'R1'});
 const contracted=linkAssetTrade(reserved,'TRADE-1');
 assert.equal(contracted.status,'CONTRACTED');
 assert.equal(buildAssetExchangeSnapshot({orders:[offer,bid],matches:[contracted],assets:[{assetId:'BAR-1'}]}).contracted,1);
});
