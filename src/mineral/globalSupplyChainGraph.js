/**
 * GEM Global Mineral Supply Chain Graph.
 * Represents country/mineral value-chain relationships as auditable edges.
 */
export const GEM_SUPPLY_CHAIN_VERSION='1.0.0';

export const SUPPLY_CHAIN_STAGES=Object.freeze([
  'EXTRACTION','CONCENTRATION','SMELTING','REFINING','INTERMEDIATE',
  'COMPONENT','MANUFACTURING','RECYCLING'
]);

export function createSupplyChainEdge(input={}){
  if(!input.from || !input.to || !input.stage) throw new TypeError('from, to and stage are required');
  if(!SUPPLY_CHAIN_STAGES.includes(input.stage)) throw new RangeError('Unsupported supply-chain stage');
  return Object.freeze({
    version:GEM_SUPPLY_CHAIN_VERSION,
    edgeId:input.edgeId || 'edge-'+Date.now().toString(36),
    mineral:String(input.mineral||'').toLowerCase(),
    from:String(input.from),
    to:String(input.to),
    stage:input.stage,
    share: Number.isFinite(Number(input.share)) ? Math.max(0,Math.min(1,Number(input.share))) : null,
    capacity:input.capacity ?? null,
    capacityUnit:input.capacityUnit || null,
    year:input.year ?? null,
    status:input.status || 'UNKNOWN',
    source:input.source || null,
    provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
  });
}

export function buildSupplyChainGraph(edges=[]){
  const nodes=new Map();
  for(const edge of edges){
    if(!edge?.from || !edge?.to) continue;
    for(const id of [edge.from,edge.to]) if(!nodes.has(id)) nodes.set(id,{id,degree:0});
    nodes.get(edge.from).degree++;
    nodes.get(edge.to).degree++;
  }
  return Object.freeze({
    version:GEM_SUPPLY_CHAIN_VERSION,
    nodeCount:nodes.size,
    edgeCount:edges.length,
    nodes:[...nodes.values()],
    edges:[...edges]
  });
}

export function findSupplyChainBottlenecks(edges=[], threshold=.75){
  return edges.filter(e=>Number.isFinite(e.share)&&e.share>=threshold)
    .map(e=>Object.freeze({
      mineral:e.mineral,
      stage:e.stage,
      from:e.from,
      to:e.to,
      concentration:e.share,
      reason:'HIGH_CHAIN_CONCENTRATION'
    }));
}
