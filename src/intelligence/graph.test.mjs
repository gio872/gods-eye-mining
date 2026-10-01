import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGraphNode,
  createGraphEdge,
  createIntelligenceGraph,
} from './graph.js';
import { buildIntelligenceGraphFromLayers } from './graphBuilder.js';

test('intelligence graph traverses only connected endpoints', () => {
  const nodes = [
    createGraphNode({ id: 'a', type: 'location', label: 'A' }),
    createGraphNode({ id: 'b', type: 'deposit', label: 'B' }),
    createGraphNode({ id: 'c', type: 'commodity', label: 'C' }),
  ];
  const edges = [
    createGraphEdge({ id: 'ab', from: 'a', to: 'b', type: 'contains' }),
    createGraphEdge({ id: 'bc', from: 'b', to: 'c', type: 'produces' }),
    createGraphEdge({ id: 'missing', from: 'a', to: 'unknown', type: 'contains' }),
  ];
  const graph = createIntelligenceGraph({ nodes, edges });
  assert.equal(graph.stats().nodes, 3);
  assert.equal(graph.stats().edges, 2);
  assert.deepEqual(graph.neighbors('a', 2).map((node) => node.id), ['a', 'b', 'c']);
  assert.equal(graph.subgraph('a', 1).edges.length, 1);
});

test('graph builder consumes live GEM snapshots and market state', () => {
  globalThis.window = {
    __terraqueenMetalMarket: {
      rows: [{ id: 'gold', symbol: 'Au', name: 'Oro', unit: 'toz', price: 3500, change: 5 }],
      timestamp: '2026-10-01T12:00:00.000Z',
      usdCop: 3800,
    },
  };
  const layers = [
    {
      id: 'gem-prospectivity',
      getSnapshot: () => ({
        targets: [{
          id: 'target-1',
          latitude: 4.44,
          longitude: -75.23,
          score: 0.91,
          confidence: 0.82,
          commodity: 'gold',
          profile: 'gold-alluvial',
          factors: { geology: 0.9 },
        }],
      }),
    },
    {
      id: 'population-places',
      getAnalystRecords: () => [{ id: 'ibague', name: 'Ibagué', type: 'city', lat: 4.4389, lon: -75.2322, rank: 1 }],
    },
    {
      id: 'local-dams',
      source: 'USACE',
      getAnalystRecords: () => [{ id: 'dam-1', name: 'Dam 1', lat: 4.45, lon: -75.24, river: 'Test River' }],
    },
    {
      id: 'anm-mining-cadastre',
      getStats: () => ({ count: 1, categoryLabel: 'Todos', lastUpdate: Date.now() }),
    },
  ];
  const graph = buildIntelligenceGraphFromLayers(layers);
  assert.ok(graph.getNode('deposit:gem:target-1'));
  assert.ok(graph.getNode('commodity:gold'));
  assert.ok(graph.getNode('market:gold'));
  assert.ok(graph.getNode('document:anm-cadastre'));
  assert.ok(graph.stats().edges >= 3);
  const focused = buildIntelligenceGraphFromLayers(layers, { focusLocation: { lat: 4.44, lon: -75.23 }, maxDistanceKm: 10 });
  assert.ok(focused.getNode('location:focus'));
  assert.ok(focused.getNode('deposit:gem:target-1'));
  assert.ok(focused.edges.some((edge) => edge.type === 'located-near'));
  delete globalThis.window;
});
