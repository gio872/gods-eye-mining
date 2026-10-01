export {
  CRITICAL_MINERAL_TAXONOMIES,
  EU_STRATEGIC_2024,
  CRITICAL_MINERAL_CATALOG_VERSION,
  getCriticalMineralRecord,
  getCriticalMineralCatalog,
  classifyMineral,
  getTaxonomyStats,
} from './catalog.js';

export {
  CRITICALITY_DIMENSIONS,
  calculateCriticalityDimensions,
  calculateCriticalityCoverage,
  buildSupplyChainProfile,
  buildSupplyShockScenario,
} from './criticality.js';

export { buildCriticalMineralOpportunity } from './opportunity.js';
