export {
  createProjectEconomicsLayer,
  createCriticalMineralsLayer,
  createEntityIntelligenceLayer,
  createTradeIntelligenceLayer,
} from './layers.js';

export {
  GRAPH_NODE_TYPES,
  GRAPH_EDGE_TYPES,
  createGraphNode,
  createGraphEdge,
  createIntelligenceGraph,
  createDemoIntelligenceGraph,
} from './graph.js';
export { createIntelligenceGraphLayer } from './graphLayer.js';

export { buildIntelligenceGraphFromLayers } from './graphBuilder.js';

export {
  CRITICAL_MINERAL_TAXONOMIES,
  EU_STRATEGIC_2024,
  CRITICAL_MINERAL_CATALOG_VERSION,
  getCriticalMineralRecord,
  getCriticalMineralCatalog,
  classifyMineral,
  getTaxonomyStats,
  CRITICALITY_DIMENSIONS,
  calculateCriticalityDimensions,
  calculateCriticalityCoverage,
  buildSupplyChainProfile,
  buildSupplyShockScenario,
  buildCriticalMineralOpportunity,
} from './criticalMinerals/index.js';
