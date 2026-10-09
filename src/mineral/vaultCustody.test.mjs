import test from 'node:test';
import assert from 'node:assert/strict';
import {createVaultFacility,createCustodyLot,attachAssay,allocateCustodyLot,requestRelease,buildCustodySnapshot} from './vaultCustody.js';

test('vault custody requires verified assay before allocation and release',()=>{
 const v=createVaultFacility({id:'v1',name:'Vault',country:'AE',type:'VAULT',apiReady:false});
 let l=createCustodyLot({id:'l1',facilityId:v.id,assetType:'BAR',commodity:'GOLD',weight:10,purity:99.9});
 assert.throws(()=>allocateCustodyLot(l,'owner','a1'),/verified assay/);
 l=attachAssay(l,{id:'a1',result:99.9,unit:'%',laboratory:'lab',verified:true});
 l=allocateCustodyLot(l,'owner','alloc1');
 l=requestRelease(l,{id:'rel1',destination:'AE'});
 assert.equal(l.status,'RELEASE_REQUESTED');
 assert.equal(buildCustodySnapshot({facilities:[v],lots:[l]}).allocated,0);
});
