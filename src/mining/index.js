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

export { createSgcGeologySource, SGC_GEOLOGY_ENDPOINTS } from './sources/sgcGeology.js';
export { createHlsSpectralSource, computeSpectralIndices, HLS_SPECTRAL_ENDPOINTS } from './sources/hlsSpectral.js';
