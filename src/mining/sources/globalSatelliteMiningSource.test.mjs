import test from 'node:test';
import assert from 'node:assert/strict';
import { createGlobalSatelliteMiningSource } from './globalSatelliteMiningSource.js';

test('satellite source exposes direct coordinate adapters for EMIT and EnMAP',async()=>{
  const calls=[];
  const source=createGlobalSatelliteMiningSource({fetchImpl:async(url)=>{calls.push(url);return {ok:true,async json(){return {sensor:'test',point:{lat:4,lon:-75}};}};}});
  await source.emitPoint({latitude:4,longitude:-75});
  await source.enmapPoint({latitude:4,longitude:-75});
  assert.match(calls[0],/emit\/point/);
  assert.match(calls[1],/enmap\/point/);
});
