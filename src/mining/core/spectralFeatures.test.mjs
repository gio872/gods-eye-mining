import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSentinel2MineralFeatures, calculateHyperspectralMineralFeatures, adaptEmitMineralEvidence } from './spectralFeatures.js';

test('Sentinel-2 mineral features calculate documented alteration proxies',()=>{
  const result=calculateSentinel2MineralFeatures({B2:.10,B3:.12,B4:.18,B6:.20,B8:.30,B11:.25,B12:.20});
  assert.ok(result.features.ferricIron>1);
  assert.ok(result.features.hydroxylClay>1);
  assert.ok(Number.isFinite(result.spectralScore));
  assert.equal(result.sensor,'Sentinel-2 MSI');
});

test('hyperspectral features calculate continuum-removed absorption proxies',()=>{
  const wavelengths=[800,820,900,1000,1100,2050,2150,2200,2250,2300,2350,2400];
  const values=[.45,.44,.43,.30,.42,.42,.41,.28,.30,.31,.42,.43];
  const result=calculateHyperspectralMineralFeatures({wavelengths,values,sensor:'EnMAP'});
  assert.ok(Number.isFinite(result.features.iron1000));
  assert.ok(Number.isFinite(result.features.alOH2200));
  assert.equal(result.sensor,'EnMAP');
});

test('EMIT evidence preserves mineral IDs and fit/depth information',()=>{
  const result=adaptEmitMineralEvidence({group1Mineral:'kaolinite',group1BandDepth:.12,group1FitScore:.9,group1Uncertainty:.01});
  assert.equal(result.mineralGroups[0].mineral,'kaolinite');
  assert.ok(result.spectralScore>0);
});
