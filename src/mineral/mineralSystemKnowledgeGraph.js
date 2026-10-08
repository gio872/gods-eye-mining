/**
 * GEM Mineral System Knowledge Graph.
 *
 * Public-safe graph primitives. Proprietary deposit templates, learned
 * relations and project-specific priors belong in the private model service.
 */

export const MINERAL_SYSTEM_GRAPH_ID='GEM-MINERAL-SYSTEM-KG';
export const MINERAL_SYSTEM_GRAPH_VERSION='1.0.0';

const NODE_TYPES=Object.freeze(['target','commodity','lithology','structure','alteration','geochemistry','geophysics','reference']);
const RELATIONS=Object.freeze(['HOSTED_BY','ASSOCIATED_WITH','CONTROLLED_BY','SUPPORTED_BY','CONTRADICTED_BY','NEAR','INDICATES']);

const clean=(v)=>String(v??'').trim();
const key=(type,id)=>`${type}:${id}`;

export function createKnowledgeGraph(){
  const nodes=new Map();
  const edges=[];
  return {
    addNode(node){
      if(!node||!NODE_TYPES.includes(node.type)||!clean(node.id)) return null;
      const normalized={...node,type:node.type,id:clean(node.id)};
      nodes.set(key(normalized.type,normalized.id),normalized);
      return normalized;
    },
    addEdge(edge){
      if(!edge||!RELATIONS.includes(edge.relation)||!clean(edge.source)||!clean(edge.target)) return null;
      const normalized={...edge,source:clean(edge.source),target:clean(edge.target)};
      edges.push(normalized);
      return normalized;
    },
    nodeCount:()=>nodes.size,
    edgeCount:()=>edges.length,
    toJSON:()=>({nodes:[...nodes.values()],edges:[...edges]})
  };
}

export function buildMineralSystemGraph(target,{commodity=null,geology=null,structure=null,spectral=null,geochemistry=null,geophysics=null,references=[]}={}){
  const graph=createKnowledgeGraph();
  const targetId=clean(target?.id||'unknown-target');
  graph.addNode({type:'target',id:targetId,latitude:target?.latitude,longitude:target?.longitude});
  if(commodity){
    graph.addNode({type:'commodity',id:clean(commodity)});
    graph.addEdge({source:key('target',targetId),target:key('commodity',commodity),relation:'ASSOCIATED_WITH'});
  }
  const evidence=[
    ['lithology',geology,'HOSTED_BY'],
    ['structure',structure,'CONTROLLED_BY'],
    ['alteration',spectral,'SUPPORTED_BY'],
    ['geochemistry',geochemistry,'SUPPORTED_BY'],
    ['geophysics',geophysics,'SUPPORTED_BY'],
  ];
  for(const [type,value,relation] of evidence){
    if(value==null) continue;
    const id=typeof value==='object'?(value.id||value.name):String(value);
    if(!clean(id)) continue;
    graph.addNode({type,id:String(id),value});
    graph.addEdge({source:key('target',targetId),target:key(type,id),relation});
  }
  for(const ref of Array.isArray(references)?references:[]){
    if(!ref) continue;
    const id=clean(ref.id||ref.name);
    if(!id) continue;
    graph.addNode({type:'reference',id,sourceId:ref.sourceId});
    graph.addEdge({source:key('target',targetId),target:key('reference',id),relation:'NEAR'});
  }
  return graph.toJSON();
}

export function graphSupportSummary(graph){
  const edges=Array.isArray(graph?.edges)?graph.edges:[];
  const supported=new Set(edges.filter(e=>['SUPPORTED_BY','HOSTED_BY','CONTROLLED_BY','ASSOCIATED_WITH'].includes(e.relation)).map(e=>e.target.split(':')[0]));
  const contradictions=edges.filter(e=>e.relation==='CONTRADICTED_BY').length;
  return {
    supportedNodeTypes:[...supported],
    independentEvidenceTypes:supported.size,
    contradictions,
    coherence:Math.max(0,Math.min(100,supported.size*16-contradictions*12))
  };
}
