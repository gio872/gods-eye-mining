import test from 'node:test';
import assert from 'node:assert/strict';
import { createGlobalPreciousMetalsLayer } from './globalPreciousMetals.js';

test('global precious metals layer exposes stable catalog identity',()=>{
  const layer=createGlobalPreciousMetalsLayer({source:{}});
  assert.equal(layer.id,'global-precious-metals');
  assert.equal(layer.showInTogglePanel,true);
  assert.equal(layer.getStats().count,0);
  assert.equal(layer.getParams().commodity,'gold');
});
