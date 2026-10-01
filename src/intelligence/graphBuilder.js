import {
  createGraphNode,
  createGraphEdge,
  createIntelligenceGraph,
} from './graph.js';

function nowIso() {
  return new Date().toISOString();
}

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function layerById(layers, id) {
  return Array.isArray(layers) ? layers.find((layer) => layer?.id === id) || null : null;
}

function addNode(nodes, node) {
  if (!nodes.some((item) => item.id === node.id)) nodes.push(node);
}

function addEdge(edges, edge) {
  if (!edges.some((item) => item.id === edge.id)) edges.push(edge);
}

export function buildIntelligenceGraphFromLayers(layers = [], {
  includeMarkets = true,
  includeProspectivity = true,
  maxTargets = 40,
} = {}) {
  const nodes = [];
  const edges = [];
  const observedAt = nowIso();

  const prospectivity = layerById(layers, 'gem-prospectivity');
  const prospectivitySnapshot = includeProspectivity
    ? prospectivity?.getSnapshot?.()
    : null;
  const targets = Array.isArray(prospectivitySnapshot?.targets)
    ? prospectivitySnapshot.targets.slice(0, Math.max(0, Number(maxTargets) || 0))
    : [];

  const targetIds = new Map();
  for (const target of targets) {
    const id = `deposit:gem:${target.id}`;
    targetIds.set(target.id, id);
    addNode(nodes, createGraphNode({
      id,
      type: 'deposit',
      label: `GEM TARGET ${Number(target.score ?? 0).toFixed(2)}`,
      subtitle: `${String(target.commodity || 'unknown').toUpperCase()} · confidence ${Number(target.confidence ?? 0).toFixed(2)}`,
      position: { lat: target.latitude, lon: target.longitude },
      properties: {
        score: target.score,
        confidence: target.confidence,
        commodity: target.commodity,
        profile: target.profile,
        factors: target.factors,
      },
      source: 'GEM Prospectivity',
      observedAt,
    }));

    const commodity = String(target.commodity || 'unknown').toLowerCase();
    const commodityId = `commodity:${commodity}`;
    addNode(nodes, createGraphNode({
      id: commodityId,
      type: 'commodity',
      label: commodity.toUpperCase(),
      subtitle: 'GEM prospectivity',
      properties: { commodity },
      source: 'GEM Prospectivity',
      observedAt,
    }));
    addEdge(edges, createGraphEdge({
      id: `edge:${id}:produces:${commodityId}`,
      from: id,
      to: commodityId,
      type: 'produces',
      source: 'GEM Prospectivity',
      observedAt,
      evidence: [{
        targetId: target.id,
        score: target.score,
        confidence: target.confidence,
      }],
    }));

    if (target.latitude != null && target.longitude != null) {
      const locationId = `location:${Number(target.latitude).toFixed(5)}:${Number(target.longitude).toFixed(5)}`;
      addNode(nodes, createGraphNode({
        id: locationId,
        type: 'location',
        label: `GEM LOCATION`,
        subtitle: `${Number(target.latitude).toFixed(5)}, ${Number(target.longitude).toFixed(5)}`,
        position: { lat: target.latitude, lon: target.longitude },
        properties: { latitude: target.latitude, longitude: target.longitude },
        source: 'GEM Prospectivity',
        observedAt,
      }));
      addEdge(edges, createGraphEdge({
        id: `edge:${id}:located-in:${locationId}`,
        from: id,
        to: locationId,
        type: 'located-in',
        source: 'GEM Prospectivity',
        observedAt,
      }));
    }
  }

  if (includeMarkets && typeof window !== 'undefined') {
    const market = window.__terraqueenMetalMarket;
    for (const row of Array.isArray(market?.rows) ? market.rows : []) {
      if (finite(row.price) === null) continue;
      const commodityId = `commodity:${row.id}`;
      const marketId = `market:${row.id}`;
      addNode(nodes, createGraphNode({
        id: commodityId,
        type: 'commodity',
        label: row.name || String(row.id).toUpperCase(),
        subtitle: `${row.symbol || ''} · ${row.unit || ''}`.trim(),
        properties: { symbol: row.symbol, unit: row.unit },
        source: 'Metals.Dev',
        observedAt: market.timestamp || observedAt,
      }));
      addNode(nodes, createGraphNode({
        id: marketId,
        type: 'market',
        label: `${String(row.symbol || row.id).toUpperCase()} MARKET`,
        subtitle: `US$ ${Number(row.price).toLocaleString('en-US')} / ${row.unit}`,
        properties: {
          price: row.price,
          unit: row.unit,
          change: row.change,
          timestamp: market.timestamp,
          usdCop: market.usdCop,
        },
        source: 'Metals.Dev',
        observedAt: market.timestamp || observedAt,
      }));
      addEdge(edges, createGraphEdge({
        id: `edge:${commodityId}:trades:${marketId}`,
        from: commodityId,
        to: marketId,
        type: 'trades',
        weight: Math.max(0, Number(row.price) || 0),
        source: 'Metals.Dev',
        observedAt: market.timestamp || observedAt,
        evidence: [{
          price: row.price,
          unit: row.unit,
          usdCop: market.usdCop,
        }],
      }));
    }
  }

  const cadastre = layerById(layers, 'anm-mining-cadastre');
  const cadastreStats = cadastre?.getStats?.();
  if (cadastreStats) {
    addNode(nodes, createGraphNode({
      id: 'document:anm-cadastre',
      type: 'document',
      label: 'ANM MINING CADASTRE',
      subtitle: cadastreStats.categoryLabel || 'Official cartography',
      properties: cadastreStats,
      source: 'ANM',
      observedAt: cadastreStats.lastUpdate
        ? new Date(cadastreStats.lastUpdate).toISOString()
        : observedAt,
    }));
  }

  addNode(nodes, createGraphNode({
    id: 'project:gem',
    type: 'project',
    label: "GOD'S EYE MINING",
    subtitle: 'Integrated intelligence project',
    properties: {
      layers: Array.isArray(layers) ? layers.length : 0,
      prospectivityTargets: targets.length,
    },
    source: 'GEM',
    observedAt,
  }));

  for (const target of targets) {
    const depositId = targetIds.get(target.id);
    if (!depositId) continue;
    addEdge(edges, createGraphEdge({
      id: `edge:project:gem:supports:${depositId}`,
      from: 'project:gem',
      to: depositId,
      type: 'supported-by',
      source: 'GEM Prospectivity',
      observedAt,
      evidence: [{
        targetId: target.id,
        score: target.score,
        confidence: target.confidence,
      }],
    }));
  }

  return createIntelligenceGraph({ nodes, edges });
}
