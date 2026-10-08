export const GEM_RUNTIME_POLICY = Object.freeze({
  cache: {
    candidateTtlMs: 60_000,
    decisionTtlMs: 300_000,
    maxClientTargets: 64,
    maxConcurrentDeepRuns: 2,
  },
  performance: {
    firstPaintBudgetMs: 1_500,
    candidateBudgetMs: 5_000,
    decisionBudgetMs: 30_000,
    globalCandidateCap: 2_048,
    localCandidateCap: 512,
  },
  storage: {
    provenanceRequired: true,
    modelVersionRequired: true,
    featureVersionRequired: true,
    auditLogRequired: true,
  },
  security: {
    credentialsServerSideOnly: true,
    tenantIsolationRequired: true,
    rateLimitRequired: true,
    signedArtifactsRequired: true,
  },
});

export function validateRunMetadata(metadata = {}) {
  const missing = [];
  if (GEM_RUNTIME_POLICY.storage.provenanceRequired && !metadata.provenance) missing.push('provenance');
  if (GEM_RUNTIME_POLICY.storage.modelVersionRequired && !metadata.modelVersion) missing.push('modelVersion');
  if (GEM_RUNTIME_POLICY.storage.featureVersionRequired && !metadata.featureVersion) missing.push('featureVersion');
  if (missing.length) throw new Error('GEM run metadata incomplete: ' + missing.join(', '));
  return true;
}
