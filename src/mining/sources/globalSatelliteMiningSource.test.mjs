import test from 'node:test';
import assert from 'node:assert/strict';
import { createGlobalSatelliteMiningSource } from './globalSatelliteMiningSource.js';

test('satellite mining source constructs a bounded STAC scene query',async()=>{
  let url='';
  const source=createGlobalSatelliteMiningSource({
    fetchImpl:async(requestUrl)=>{
      url=requestUrl;
      return {ok:true,async json(){return {collection:'sentinel-2-l2a',count:0,items:[]};}};
    },
  });
  const result=await source.scenes({
    bbox:{west:-75,south:4,east:-74,north:5},
    collection:'sentinel-2-l2a',
    start:'2026-01-01',
    end:'2026-10-01',
    maxCloud:15,
    limit:8,
  });
  assert.equal(result.count,0);
  assert.match(url,/global-satellite-mining\/scenes/);
  assert.match(url,/collection=sentinel-2-l2a/);
  assert.match(url,/maxCloud=15/);
});

test('satellite source exposes the global mining intelligence catalog',async()=>{
  const source=createGlobalSatelliteMiningSource({
    fetchImpl:async()=>({ok:true,async json(){return {sources:[{id:'mine-the-gap'},{id:'sentinel-2'}]};}}),
  });
  const result=await source.sources();
  assert.deepEqual(result.sources.map((row)=>row.id),['mine-the-gap','sentinel-2']);
});


test('EMIT and EnMAP coordinate methods route through the dedicated provider',async()=>{const urls=[];const source=createGlobalSatelliteMiningSource({fetchImpl:async(url)=>{urls.push(url);return {ok:true,async json(){return urls.length===1?{pending:true}:{count:0,items:[]};}};}});const emit=await source.emitPoint({latitude:4.44,longitude:-75.24});const enmap=await source.enmapPoint({latitude:4.44,longitude:-75.24});assert.equal(emit.pending,true);assert.equal(enmap.count,0);assert.match(urls[0],/emit-enmap\\/emit-point/);assert.match(urls[1],/emit-enmap\\/enmap-point/);});
