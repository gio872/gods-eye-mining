import { GEM_CAPABILITY_MATRIX, summarizeGemCapabilities } from '../src/mineral/gemCapabilityMatrix.js';

describe('GEM capability matrix', () => {
  it('covers the planetary mining operating layers', () => {
    const summary = summarizeGemCapabilities();
    expect(summary.capabilityCount).toBe(GEM_CAPABILITY_MATRIX.length);
    expect(summary.capabilityCount).toBeGreaterThanOrEqual(10);
    expect(Object.keys(summary.layers)).toEqual(expect.arrayContaining(['DATA','EVIDENCE','INTELLIGENCE','DECISION','ASSET','MARKET','TRUST']));
  });

  it('keeps strategic commodities explicit and configurable', () => {
    const summary = summarizeGemCapabilities();
    expect(summary.strategicCommodities).toEqual(expect.arrayContaining(['gold','copper','lithium','rare earth elements','tungsten']));
  });
});