import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssetTwin,applyTwinEvent,buildTwinIntegrity,buildTwinSnapshot} from './assetDigitalTwin.js';

test('digital twin projects evidenced physical lifecycle',()=>{
 let t=createAssetTwin({passportId:'GEM-AP-BAR-1',assetId:'BAR-1',commodity:'GOLD',assetType:'BAR'});
 t=applyTwinEvent(t,{id:'e1',type:'ASSAY',evidenceHash:'sha256:a',sourceId:'lab'});
 t=applyTwinEvent(t,{id:'e2',type:'CUSTODY',facilityId:'vault-1',evidenceHash:'sha256:b'});
 t=applyTwinEvent(t,{id:'e3',type:'TRADE',links:{tradeId:'trade-1'},evidenceHash:'sha256:c'});
 assert.equal(t.state,'TRADE_COMMITTED');
 assert.equal(t.facilityId,'vault-1');
 assert.equal(t.links.tradeId,'trade-1');
 assert.equal(buildTwinIntegrity(t).evidenceCoverage,1);
 assert.equal(buildTwinSnapshot([t]).tradeCommitted,1);
});
