export {
  MINING_COMMODITIES,
  PROSPECTIVITY_FACTORS,
  clamp,
  createMiningTarget,
  normalizeFactorMap,
  normalizeCoordinate,
} from './core/miningTypes.js';

export { createProspectivityEngine } from './core/prospectivityEngine.js';
export { createMiningEngine } from './core/miningEngine.js';

export {
  calculateGrossMetalValue,
  normalizeRecoveryPercent,
} from './core/economicValue.js';

export { createGeophysicsEngine } from './core/geophysicsEngine.js';
export { createSubsurfaceObservation, createSubsurfaceTarget, GEOPHYSICS_MODALITIES, GEOPHYSICS_MINERALS } from './core/geophysicsTypes.js';
export { GLOBAL_PRECIOUS_METALS, GLOBAL_PRECIOUS_METAL_IDS, getPreciousMetalDefinition, normalizeGlobalOccurrence, estimateTargetDepth } from './core/globalPreciousMetalsTypes.js';
export { createGlobalPreciousMetalsEngine, scoreDocumentedOccurrence, scoreProspectivePoint } from './core/globalPreciousMetalsEngine.js';
