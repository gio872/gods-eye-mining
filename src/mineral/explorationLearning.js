/**
 * GEM Exploration Learning Contract.
 *
 * Stores field/drill outcomes as evidence without pretending they are
 * resources or reserves. The learning record is versioned and auditable.
 */
export const GEM_LEARNING_VERSION = '1.0.0';

export const OUTCOME_TYPES = Object.freeze(['DRILL','ASSAY','FIELD_VALIDATION','REMOTE_VALIDATION']);

function requireText(value, name) {
  if (!value || typeof value !== 'string') throw new TypeError(name + ' is required');
  return value;
}

export function createExplorationOutcome(input = {}) {
  const outcomeType = requireText(input.outcomeType, 'outcomeType').toUpperCase();
  if (!OUTCOME_TYPES.includes(outcomeType)) throw new RangeError('Unsupported exploration outcome type');
  const targetId = requireText(input.targetId, 'targetId');
  const runId = requireText(input.runId, 'runId');
  return Object.freeze({
    learningVersion: GEM_LEARNING_VERSION,
    outcomeId: input.outcomeId || 'outcome-' + Date.now().toString(36),
    targetId,
    runId,
    outcomeType,
    observedAt: input.observedAt || new Date().toISOString(),
    location: input.location || null,
    observations: Array.isArray(input.observations) ? [...input.observations] : [],
    assays: Array.isArray(input.assays) ? input.assays.map(a => ({...a})) : [],
    geologicalInterpretation: input.geologicalInterpretation || null,
    contradictions: Array.isArray(input.contradictions) ? [...input.contradictions] : [],
    provenance: Array.isArray(input.provenance) ? [...input.provenance] : [],
    validationStatus: input.validationStatus || 'UNVERIFIED',
  });
}

export function buildLearningSignal(outcome) {
  const validated = outcome && outcome.validationStatus === 'VALIDATED';
  return Object.freeze({
    targetId: outcome.targetId,
    outcomeId: outcome.outcomeId,
    learningVersion: GEM_LEARNING_VERSION,
    validated,
    signal: validated ? 'EVIDENCE_CONFIRMED' : 'EVIDENCE_PENDING_VALIDATION',
    assayCount: Array.isArray(outcome.assays) ? outcome.assays.length : 0,
    observationCount: Array.isArray(outcome.observations) ? outcome.observations.length : 0,
    contradictionCount: Array.isArray(outcome.contradictions) ? outcome.contradictions.length : 0,
  });
}

export function applyLearningSignals(targets = [], outcomes = []) {
  const byTarget = new Map();
  for (const outcome of outcomes) {
    if (!outcome || !outcome.targetId) continue;
    const list = byTarget.get(outcome.targetId) || [];
    list.push(outcome);
    byTarget.set(outcome.targetId, list);
  }
  return targets.map(target => {
    const evidence = byTarget.get(target.id) || [];
    const signals = evidence.map(buildLearningSignal);
    const confirmed = signals.some(s => s.validated);
    return {
      ...target,
      learning: {
        version: GEM_LEARNING_VERSION,
        outcomeCount: evidence.length,
        validatedOutcomeCount: signals.filter(s => s.validated).length,
        confirmed,
        signals,
      },
    };
  });
}