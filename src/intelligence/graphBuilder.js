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

function distanceKm(a, b) {
  const lat1 = Number(a?.lat), lon1 = Number(a?.lon), lat2 = Number(b?.lat), lon2 = Number(b?.lon);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function addSpatialRecord(nodes, edges, record, type, source, focus, maxDistanceKm) {
  if (!record || distanceKm(focus, record) > maxDistanceKm) return null;
  const id = `${type}:${String(record.id || record.name || 'unknown')}`;
  addNode(nodes, createGraphNode({
    id, type, label: String(record.name || record.id || type).slice(0, 48),
    subtitle: String(record.type || record.placeClass || source),
    position: { lat: record.lat, lon: record.lon },
    properties: { ...record }, source, observedAt: nowIso(),
  }));
  addEdge(edges, createGraphEdge({
    id: `edge:focus:near:${id}`, from: 'location:focus', to: id, type: 'located-near',
    weight: 1 / Math.max(0.1, distanceKm(focus, record)), source, observedAt: nowIso(),
  }));
  return id;
}

export function buildIntelligenceGraphFromLayers(layers = [], {
  includeMarkets = true,
  includeProspectivity = true,
  maxTargets = 40,
  focusLocation = null,
  maxDistanceKm = 75,
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

  if (focusLocation && Number.isFinite(Number(focusLocation.lat)) && Number.isFinite(Number(focusLocation.lon))) {
    const focus = { lat: Number(focusLocation.lat), lon: Number(focusLocation.lon) };
    addNode(nodes, createGraphNode({
      id: 'location:focus', type: 'location', label: 'MAP FOCUS',
      subtitle: `${focus.lat.toFixed(5)}, ${focus.lon.toFixed(5)}`,
      position: focus, properties: focus, source: 'GEM Map Selection', observedAt,
    }));
    for (const target of targets) {
      const record = { id: target.id, name: `GEM ${String(target.commodity || '').toUpperCase()}`, lat: target.latitude, lon: target.longitude };
      addSpatialRecord(nodes, edges, record, 'deposit', 'GEM Prospectivity', focus, maxDistanceKm);
    }
    const population = layerById(layers, 'population-places');
    for (const record of population?.getAnalystRecords?.(500) || [])
      addSpatialRecord(nodes, edges, record, 'location', 'OpenFreeMap · OpenStreetMap', focus, maxDistanceKm);
    for (const layer of layers) {
      if (!String(layer?.id || '').startsWith('local-')) continue;
      for (const record of layer?.getAnalystRecords?.(500) || [])
        addSpatialRecord(nodes, edges, record, 'facility', layer.source || layer.id, focus, maxDistanceKm);
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
