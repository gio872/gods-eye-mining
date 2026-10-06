import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpectralMineralSource } from './spectralMineralSource.js';

test('spectral mineral source exposes Sentinel-2 and hyperspectral adapters',()=>{
  const source=createSpectralMineralSource();
  assert.ok(source.calculateSentinel2({B2:.1,B3:.1,B4:.2,B6:.2,B8:.3,B11:.2,B12:.18}).spectralScore!==null);
  assert.equal(source.calculateHyperspectral({wavelengths:[800,900,1000,1100,2200],values:[.4,.3,.25,.4,.2],sensor:'EnMAP'}).sensor,'EnMAP');
  assert.equal(source.adaptEmit({group1Mineral:'hematite'}).mineralGroups[0].mineral,'hematite');
});
