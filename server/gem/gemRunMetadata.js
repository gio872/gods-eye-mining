import { createRunRecord } from './gemStateStore.js';

export async function createPersistentRunMetadata({ runId, modelVersion, featureVersion, provenance = [], sourceVersions = {} } = {}) {
  return createRunRecord({ runId, modelVersion, featureVersion, provenance, sourceVersions });
}