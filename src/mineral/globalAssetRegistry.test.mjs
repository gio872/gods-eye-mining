import test from 'node:test';
import assert from 'node:assert/strict';
import {registerAssetTwin,indexAssetTwins,searchAssetRegistry,buildAssetMapFeatures,buildAssetRegistrySnapshot} from './globalAssetRegistry.js';

const twin={twinId:'GEM-TWIN-1',passportId:'GEM-AP-1',assetId:'BAR-1',commodity:'GOLD',assetType:'BAR',state:'IN_CUSTODY',links:{tradeId:'T1'},evidenceHashes:['h1'],events:[{id:'e1'}]};

test('global asset registry filters and only maps evidenced locations',()=>{
 const a=registerAssetTwin(twin,{country:'CO',location:{latitude:4.44,longitude:-75.24,label:'validated site'},locationEvidence:{sourceId:'survey-1'}});
 const b=registerAssetTwin({...twin,twinId:'GEM-TWIN-2',assetId:'BAR-2'},{country:'CO'});
 const all=indexAssetTwins([twin],{});
 assert.equal(searchAssetRegistry([a,b],{commodity:'gold'}).length,2);
 assert.equal(searchAssetRegistry([a,b],{tradeOnly:true}).length,2);
 assert.equal(buildAssetMapFeatures([a,b]).length,1);
 assert.equal(buildAssetRegistrySnapshot([a,b]).locatedAssets,1);
 assert.equal(all.records.length,1);
});
