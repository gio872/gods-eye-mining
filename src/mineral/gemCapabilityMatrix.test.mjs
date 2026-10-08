import test from 'node:test';
import assert from 'node:assert/strict';
import { GEM_CAPABILITY_MATRIX, summarizeGemCapabilities } from './gemCapabilityMatrix.js';

test('GEM capability matrix covers planetary mining layers', () => {
  const summary = summarizeGemCapabilities();
  assert.equal(summary.capabilityCount, GEM_CAPABILITY_MATRIX.length);
  assert.ok(summary.capabilityCount >= 10);
  for (const layer of ['DATA','EVIDENCE','INTELLIGENCE','DECISION','ASSET','MARKET','TRUST']) assert.ok(summary.layers[layer] >= 1);
});

test('GEM strategic commodity universe includes core metals', () => {
  const commodities = summarizeGemCapabilities().strategicCommodities;
  for (const item of ['gold','copper','lithium','rare earth elements','tungsten']) assert.ok(commodities.includes(item));
});