/** 
 * God's Eye Intelligence Graph — provider-neutral domain graph.
 * Nodes and edges are immutable records carrying provenance.
 */

export const GRAPH_NODE_TYPES = Object.freeze([
  'location','deposit','mining-right','commodity','company','person',
  'owner','project','facility','port','shipment','transaction',
  'country','sanction','pep','media','document','market',
]);

export const GRAPH_EDGE_TYPES = Object.freeze([
  'located-in','contains','produces','holds-right','owned-by','controls',
  'directs','works-for','operates','processes','refines','ships-to',
  'ships-from','trades','transacts-with','registered-in','located-near',
  'screened-against','mentioned-in','supported-by','derived-from',
]);

function clean(value) { return String(value ?? '').trim(); }

export function createGraphNode({ id, type, label, subtitle='', position=null, properties={}, source='gem', observedAt=null } = {}) {
  if (!clean(id)) throw new TypeError('Graph node id is required');
  if (!GRAPH_NODE_TYPES.includes(type)) throw new TypeError(`Unsupported graph node type: ${type}`);
  return Object.freeze({
    id: clean(id), type, label: clean(label) || clean(id), subtitle: clean(subtitle),
    position: position && Number.isFinite(Number(position.lat)) && Number.isFinite(Number(position.lon))
      ? Object.freeze({ lat:Number(position.lat), lon:Number(position.lon) }) : null,
    properties: Object.freeze({ ...properties }),
    source: clean(source) || 'unknown',
    observedAt: observedAt ? String(observedAt) : null,
  });
}

export function createGraphEdge({ id, from, to, type, label='', weight=1, source='gem', observedAt=null, evidence=[] } = {}) {
  if (!clean(id) || !clean(from) || !clean(to)) throw new TypeError('Graph edge id, from and to are required');
  if (!GRAPH_EDGE_TYPES.includes(type)) throw new TypeError(`Unsupported graph edge type: ${type}`);
  return Object.freeze({
    id:clean(id), from:clean(from), to:clean(to), type, label:clean(label) || type,
    weight:Number.isFinite(Number(weight)) ? Number(weight) : 1,
    source:clean(source) || 'unknown', observedAt:observedAt ? String(observedAt) : null,
    evidence:Object.freeze(Array.isArray(evidence) ? evidence.map((item)=>Object.freeze({ ...item })) : []),
  });
}

export function createIntelligenceGraph({ nodes=[], edges=[] } = {}) {
  const nodeMap = new Map();
  const edgeMap = new Map();
  for (const node of nodes) {
    const normalized = node?.id ? node : createGraphNode(node);
    nodeMap.set(normalized.id, normalized);
  }
  for (const edge of edges) {
    const normalized = edge?.id ? edge : createGraphEdge(edge);
    if (nodeMap.has(normalized.from) && nodeMap.has(normalized.to)) edgeMap.set(normalized.id, normalized);
  }
  function neighbors(nodeId, depth=1) {
    const seen = new Set([clean(nodeId)]);
    let frontier = [...seen];
    for (let level=0; level<Math.max(0, Number(depth)||0); level += 1) {
      const next=[];
      for (const edge of edgeMap.values()) {
        if (!frontier.includes(edge.from) && !frontier.includes(edge.to)) continue;
        const candidate=frontier.includes(edge.from) ? edge.to : edge.from;
        if (!seen.has(candidate)) { seen.add(candidate); next.push(candidate); }
      }
      frontier=next;
      if (!frontier.length) break;
    }
    return [...seen].filter((id)=>nodeMap.has(id)).map((id)=>nodeMap.get(id));
  }
  function subgraph(seedId, depth=2) {
    const ids=new Set(neighbors(seedId, depth).map((node)=>node.id));
    return {
      nodes:[...nodeMap.values()].filter((node)=>ids.has(node.id)),
      edges:[...edgeMap.values()].filter((edge)=>ids.has(edge.from)&&ids.has(edge.to)),
    };
  }
  function find(query='') {
    const q=clean(query).toLowerCase();
    if (!q) return [...nodeMap.values()];
    return [...nodeMap.values()].filter((node)=>[node.id,node.label,node.subtitle,node.type,...Object.values(node.properties)].some((v)=>String(v??'').toLowerCase().includes(q)));
  }
  return Object.freeze({
    get nodes(){ return [...nodeMap.values()]; },
    get edges(){ return [...edgeMap.values()]; },
    getNode(id){ return nodeMap.get(id) || null; },
    neighbors, subgraph, find,
    stats(){ return { nodes:nodeMap.size, edges:edgeMap.size, types:[...new Set([...nodeMap.values()].map((n)=>n.type))] }; },
  });
}

export function createDemoIntelligenceGraph() {
  const nodes=[
    ['location:sample','location','PROJECT AREA','Selected map location'],
    ['deposit:sample','deposit','MINERAL OCCURRENCE','Prospectivity target'],
    ['commodity:gold','commodity','GOLD','Au'],
    ['right:sample','mining-right','MINING RIGHT','Cadastre record'],
    ['company:operator','company','OPERATOR / COMPANY','Provider data required'],
    ['person:ubo','person','UBO / DIRECTOR','Provider data required'],
    ['project:sample','project','MINING PROJECT','Economic model'],
    ['facility:plant','facility','PROCESSING FACILITY','Infrastructure evidence'],
    ['port:pacific','port','EXPORT PORT','Trade corridor model'],
    ['market:gold','market','GOLD MARKET','Metal Markets'],
    ['country:sample','country','JURISDICTION','Country context'],
    ['sanctions:screen','sanction','SANCTIONS SCREEN','Provider required'],
  ].map(([id,type,label,subtitle])=>createGraphNode({id,type,label,subtitle,source:type==='sanction'?'provider-required':'gem'}));
  const edges=[
    ['e1','location:sample','deposit:sample','contains'],
    ['e2','deposit:sample','commodity:gold','produces'],
    ['e3','deposit:sample','right:sample','holds-right'],
    ['e4','right:sample','company:operator','operates'],
    ['e5','company:operator','person:ubo','owned-by'],
    ['e6','company:operator','project:sample','operates'],
    ['e7','project:sample','facility:plant','processes'],
    ['e8','facility:plant','port:pacific','ships-to'],
    ['e9','commodity:gold','market:gold','trades'],
    ['e10','company:operator','country:sample','registered-in'],
    ['e11','person:ubo','sanctions:screen','screened-against'],
  ].map(([id,from,to,type])=>createGraphEdge({id,from,to,type}));
  return createIntelligenceGraph({nodes,edges});
}
