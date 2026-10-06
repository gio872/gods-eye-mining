import test from 'node:test';
import assert from 'node:assert/strict';
import { createGlobalPreciousMetalsSource } from './globalPreciousMetalsSource.js';

test('global occurrence source builds a bounded query',async()=>{
  const calls=[];
  const source=createGlobalPreciousMetalsSource({
    fetchImpl:async(url,options)=>{
      calls.push({url,options});
      return {ok:true,async json(){return {commodity:'gold',count:1,occurrences:[{id:'1'}]};}};
    }
  });
  const result=await source.occurrences({bbox:{west:-75,south:4,east:-74,north:5},commodity:'gold',limit:10});
  assert.equal(result.count,1);
  assert.match(calls[0].url,/global-precious-metals\/occurrences/);
  assert.match(calls[0].url,/commodity=gold/);
  assert.deepEqual(calls[0].options.headers,{Accept:'application/json'});
});

test('point analysis source forwards coordinate and commodity',async()=>{
  let url='';
  const source=createGlobalPreciousMetalsSource({
    fetchImpl:async(requestUrl)=>{url=requestUrl;return {ok:true,async json(){return {score:0.7,commodity:'silver'};}};}
  });
  const result=await source.analyzePoint({latitude:4.44,longitude:-75.24,commodity:'silver'});
  assert.equal(result.score,0.7);
  assert.match(url,/lat=4\.44/);
  assert.match(url,/lon=-75\.24/);
  assert.match(url,/commodity=silver/);
});
