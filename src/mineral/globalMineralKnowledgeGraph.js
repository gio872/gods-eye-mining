/**
 * GEM Global Mineral Knowledge Graph.
 * Connects countries, minerals, mines, miners/operators, traders,
 * refineries, projects, trade and applications.
 */
export const GEM_GLOBAL_KG_VERSION='1.1.0';

export const GLOBAL_NODE_TYPES=Object.freeze([
 'country','mineral','mine','deposit','miner','mine_operator','trader',
 'refinery','smelter','project','trade_route','infrastructure','technology',
 'application','company','source'
]);

export const GLOBAL_RELATIONS=Object.freeze([
 'PRODUCES','CONTAINS','REFINES','SMELTS','PROCESSES','EXPORTS_TO','IMPORTS_FROM',
 'SUPPLIES','DEPENDS_ON','USED_IN','LOCATED_IN','CONNECTS_TO','DEVELOPS',
 'OWNED_BY','OPERATES','OPERATED_BY','TRADES_FROM','OFFTAKES_FROM',
 'SUPPORTED_BY','DOCUMENTED_BY','BYPRODUCT_OF','RECYCLES'
]);

const clean=v=>String(v??'').trim();
const id=(type,value)=>type+':'+clean(value);

export function createGlobalKnowledgeGraph(){
 const nodes=new Map(),edges=[];
 return {
  addNode(node){if(!node||!GLOBAL_NODE_TYPES.includes(node.type)||!clean(node.id))return null;const n={...node,id:clean(node.id)};nodes.set(id(n.type,n.id),n);return n;},
  addEdge(edge){if(!edge||!GLOBAL_RELATIONS.includes(edge.relation)||!clean(edge.source)||!clean(edge.target))return null;const e={...edge,source:clean(edge.source),target:clean(edge.target)};edges.push(e);return e;},
  toJSON(){return {version:GEM_GLOBAL_KG_VERSION,nodes:[...nodes.values()],edges:[...edges]};},
  nodeCount:()=>nodes.size, edgeCount:()=>edges.length
 };
}

export function addGlobalSupplyRelationship(graph,input={}){
 const fromType=clean(input.fromType),toType=clean(input.toType);
 if(!GLOBAL_NODE_TYPES.includes(fromType)||!GLOBAL_NODE_TYPES.includes(toType))throw new TypeError('Invalid node type');
 const from=clean(input.from),to=clean(input.to);
 if(!from||!to)throw new TypeError('from and to are required');
 graph.addNode({type:fromType,id:from,name:input.fromName||from});
 graph.addNode({type:toType,id:to,name:input.toName||to});
 graph.addEdge({
  source:id(fromType,from),target:id(toType,to),relation:input.relation,
  mineral:input.mineral||null,share:input.share??null,year:input.year??null,
  sourceId:input.sourceId||null,provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
 return graph;
}

export function addMiningParticipantToGraph(graph,participant={}){
 const type=clean(participant.type).toUpperCase();
 const nodeType=type==='MINER'||type==='PRODUCER'?'miner':
  type==='MINE_OPERATOR'?'mine_operator':
  type==='TRADER'||type==='COMMODITY_TRADER'?'trader':
  type==='MINE'?'mine':null;
 if(!nodeType||!participant.id)return graph;
 graph.addNode({type:nodeType,id:clean(participant.id),name:participant.name||participant.id,
  country:participant.country||null,commodities:participant.commodities||[],
  verificationStatus:participant.verificationStatus||'UNVERIFIED',
  sourceId:participant.sourceId||null,provenance:participant.provenance||[]});
 for(const mineId of participant.mineIds||[]){
  graph.addEdge({source:id(nodeType,participant.id),target:id('mine',mineId),
   relation:nodeType==='trader'?'TRADES_FROM':'OPERATES',
   mineral:null,sourceId:participant.sourceId||null,provenance:participant.provenance||[]});
 }
 for(const operatorId of participant.operatorIds||[]){
  graph.addEdge({source:id(nodeType,participant.id),target:id('mine_operator',operatorId),
   relation:'OPERATED_BY',sourceId:participant.sourceId||null,provenance:participant.provenance||[]});
 }
 return graph;
}

export function findCriticalDependencies(graph,{minShare=.75}={}){
 const edges=Array.isArray(graph?.edges)?graph.edges:[];
 return edges.filter(e=>Number.isFinite(Number(e.share))&&Number(e.share)>=minShare).map(e=>({...e,criticalDependency:true}));
}
export function findByproductChains(graph){
 const edges=Array.isArray(graph?.edges)?graph.edges:[];
 return edges.filter(e=>e.relation==='BYPRODUCT_OF');
}
