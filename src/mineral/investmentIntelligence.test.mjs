import assert from 'node:assert/strict';
import { buildInvestmentProfile, buildPortfolioSnapshot, rankInvestmentTargets } from './investmentIntelligence.js';

const target = {
  id: 'GEM-TEST-01',
  score: 88,
  commodities: ['gold'],
  trueProspectivity: {
    score: 82, confidence: 76, coverage: 80,
    channels: { geology: 80, geophysics: 72, geochemistry: 90 },
    mineralSystem: { contradictions: 0 },
    explorationPlan: { nextBestAction: { valueScore: 70, channel: 'spectral' } },
  },
};
const profile = buildInvestmentProfile(target);
assert.equal(profile.engine.id, 'GEM-INVESTMENT-INTELLIGENCE');
assert.equal(profile.maturity, 'ADVANCED_TARGET');
assert.equal(profile.investorState, 'TECHNICAL_DUE_DILIGENCE_REQUIRED');
assert.ok(profile.risk.level !== 'HIGH');
assert.ok(profile.risk.evidenceGaps.includes('spectral'));
const weak = { id: 'GEM-WEAK', score: 20, trueProspectivity: { score: 20 } };
assert.equal(rankInvestmentTargets([weak, target])[0].target.id, 'GEM-TEST-01');
const snapshot = buildPortfolioSnapshot([target, weak]);
assert.equal(snapshot.targetCount, 2);
assert.equal(snapshot.topTarget, 'GEM-TEST-01');
assert.equal(snapshot.advancedTargets, 1);
