import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupplierRecord, buildSupplierNetwork, filterSuppliers } from './globalSupplierRegistry.js';

test('supplier registry supports precious metals and petroleum',()=>{
 const gold=createSupplierRecord({id:'s1',name:'Supplier A',country:'Colombia',type:'PRODUCER',family:'PRECIOUS_METALS',commodities:['gold'],sourceId:'official',verificationStatus:'VERIFIED'});
 const oil=createSupplierRecord({id:'s2',name:'Supplier B',country:'Guyana',type:'OIL_PRODUCER',family:'PETROLEUM',commodities:['crude oil'],sourceId:'official'});
 assert.equal(filterSuppliers([gold,oil],{family:'PRECIOUS_METALS'}).length,1);
 assert.equal(filterSuppliers([gold,oil],{commodity:'crude oil'})[0].id,'s2');
 assert.equal(buildSupplierNetwork([gold,oil]).supplierCount,2);
});
