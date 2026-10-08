import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssetPassport,verifyAssetPassport,linkAssetPassport,buildAssetPassportSnapshot} from './assetPassport.js';

test('asset passport creates an auditable identity and links trade/settlement',()=>{
 let p=createAssetPassport({assetId:'BAR-001',assetType:'BAR',commodity:'GOLD',weight:12.5});
 assert.equal(p.status,'IDENTIFIED');
 p=verifyAssetPassport(p,{id:'v1',evidenceHash:'sha256:abc',sourceId:'assay-lab'});
 p=linkAssetPassport(p,{custodyLotId:'lot-1',tradeId:'trade-1',settlementId:'settle-1',evidenceHashes:['sha256:def']});
 assert.equal(p.status,'VERIFIED');
 assert.equal(p.tradeId,'trade-1');
 assert.equal(p.settlementId,'settle-1');
 assert.equal(buildAssetPassportSnapshot([p]).settlementLinked,1);
 assert.equal(p.evidenceHashes.length,2);
});
