import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCountryMineralProfile, buildSupplyRiskSignals, GOVERNMENT_DATA_DOMAINS } from './governmentMineralIntelligence.js';

test('government profile preserves provenance and data gaps', () => {
  const p=buildCountryMineralProfile({
    country:'Colombia', mineral:'copper',
    indicators:{import_dependence:.8,processing_concentration:.9},
    dataGaps:['refinery capacity'],
    sources:[{publisher:'UNCTAD',year:2024}]
  });
  assert.equal(p.provenanceRequired,true);
  assert.deepEqual(buildSupplyRiskSignals(p).signals,['HIGH_IMPORT_DEPENDENCE','HIGH_PROCESSING_CONCENTRATION']);
  assert.ok(GOVERNMENT_DATA_DOMAINS.length >= 10);
});
