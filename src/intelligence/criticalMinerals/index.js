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

export { SUPPLY_CHAIN_STAGES, createSupplyChainSnapshot } from './supplyChain.js';
export { COUNTRY_RISK_FIELDS, calculateCountryMineralRisk } from './countryRisk.js';
export { MARKET_RISK_FIELDS, calculateMarketRisk } from './marketRisk.js';
export { modelSupplyShockScenario } from './shockModel.js';

export { CRITICAL_MINERAL_SOURCES, getCriticalMineralSources, createSourceObservation, normalizeWorldProductionRow } from './sources.js';
export { ingestWorldProduction, aggregateCountryProduction, concentrationShare } from './dataPipeline.js';
