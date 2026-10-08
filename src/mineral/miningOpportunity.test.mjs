import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyDiscoveryOpportunity,
  summarizeTriage,
  triageTargets,
} from './miningOpportunity.js';

test('high prospectivity with no mining activity becomes a discovery opportunity', () => {
  const result = classifyDiscoveryOpportunity({
    score: 88,
    miningActivityEvidence: {
      score: null,
      coverage: 100,
      detectionCount: 0,
      confirmedCount: 0,
    },
  });
  assert.equal(result.classification, 'DISCOVERY OPPORTUNITY');
  assert.equal(result.discoveryOpportunityScore, 88);
});

test('active mining is separated from greenfield discovery', () => {
  const result = classifyDiscoveryOpportunity({
    score: 90,
    miningActivityEvidence: {
      score: 82,
      coverage: 100,
      detectionCount: 12,
      confirmedCount: 10,
      onsetYears: [2019, 2020, 2024],
    },
  });
  assert.equal(result.classification, 'ACTIVE MINING ZONE');
  assert.ok(result.discoveryOpportunityScore < 90);
  assert.equal(result.temporalSignal, 'RECENT_ONSET');
});

test('outside Earthrise coverage does not become a false negative', () => {
  const result = classifyDiscoveryOpportunity({
    score: 78,
    miningActivityEvidence: {
      score: null,
      coverage: 0,
      detectionCount: 0,
      confirmedCount: 0,
      activity: 'not_covered',
    },
  });
  assert.equal(result.classification, 'EXPLORATION FRONTIER');
  assert.equal(result.discoveryOpportunityScore, 78);
  assert.equal(result.activityCoverage, 'not_covered');
});

test('triage reorders targets by operational opportunity', () => {
  const targets = triageTargets([
    {
      id: 'active',
      score: 95,
      miningActivityEvidence: { score: 90, coverage: 100 },
    },
    {
      id: 'greenfield',
      score: 82,
      miningActivityEvidence: { score: null, coverage: 100 },
    },
  ]);
  assert.equal(targets[0].id, 'greenfield');
  assert.equal(targets[0].operationalRank, 1);
  assert.equal(summarizeTriage(targets).discovery, 1);
});
