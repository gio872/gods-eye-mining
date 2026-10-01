import { createDemoIntelligenceGraph } from './graph.js';
import { buildIntelligenceGraphFromLayers } from './graphBuilder.js';

const TYPE_SYMBOLS=Object.freeze({
  location:'⌖',deposit:'◆',commodity:'◈','mining-right':'▣',company:'●',person:'◎',
  owner:'◎',project:'◇',facility:'▤',port:'⚓',shipment:'⇄',transaction:'₿',
  country:'▦',sanction:'!',pep:'P',media:'M',document:'□',market:'$',
});

const TYPE_LABELS=Object.freeze({
  location:'LOCATION',deposit:'DEPOSIT',commodity:'COMMODITY','mining-right':'MINING RIGHT',
  company:'COMPANY',person:'PERSON',owner:'OWNER',project:'PROJECT',facility:'FACILITY',
  port:'PORT',shipment:'SHIPMENT',transaction:'TRANSACTION',country:'COUNTRY',
  sanction:'SANCTIONS',pep:'PEP',media:'MEDIA',document:'DOCUMENT',market:'MARKET',
});

function esc(value){return String(value??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);}
function nodeColor(type){
  if(['deposit','commodity','market'].includes(type)) return '#f2c55d';
  if(['company','person','owner','sanction','pep'].includes(type)) return '#ef8b8b';
  if(['project','facility','port','shipment','transaction'].includes(type)) return '#67dfe6';
  return '#9db8bd';
}
function shell(){
  const panel=document.createElement('section');
  panel.id='terraqueen-intelligence-graph';
  panel.style.cssText=[
    'position:absolute','top:72px','left:50%','transform:translateX(-50%)','width:min(980px,calc(100vw - 40px))',
    'height:min(700px,calc(100vh - 120px))','box-sizing:border-box','padding:14px',
    'background:linear-gradient(150deg,rgba(3,14,20,.98),rgba(7,25,31,.96))',
    'border:1px solid rgba(32,206,216,.3)','border-radius:12px','box-shadow:0 22px 70px rgba(0,0,0,.6)',
    'z-index:180','font-family:monospace','color:#eef8fa','overflow:hidden',
  ].join(';');
  panel.innerHTML='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:10px">'+
    '<div><div style="font-size:8px;color:#f2c55d;letter-spacing:.16em;font-weight:700">GOD\'S EYE · INTELLIGENCE GRAPH</div>'+
    '<div style="font:700 18px system-ui,sans-serif;letter-spacing:.05em;margin-top:3px">GEOINT ↔ MINING ↔ ENTITY ↔ MONEY ↔ TRADE</div>'+
    '<div id="gem-graph-summary" style="font-size:8px;color:#67dfe6;margin-top:3px"></div></div>'+
    '<button id="gem-graph-close" style="border:1px solid rgba(32,206,216,.28);background:transparent;color:#9fe9ed;border-radius:5px;padding:5px 9px;cursor:pointer">CLOSE</button></div>';
  return panel;
}

function renderGraphSvg(container, graph, seedId, onSelect){
  const {nodes,edges}=activeGraph.subgraph(seedId,2);
  const width=container.clientWidth||900, height=container.clientHeight||500;
  const cx=width/2, cy=height/2;
  const seed=nodes.find(n=>n.id===seedId)||nodes[0];
  const others=nodes.filter(n=>n.id!==seed?.id);
  const positions=new Map();
  if(seed) positions.set(seed.id,{x:cx,y:cy});
  others.forEach((node,index)=>{
    const angle=(index/Math.max(1,others.length))*Math.PI*2-Math.PI/2;
    const radius=Math.min(width,height)*.31;
    positions.set(node.id,{x:cx+Math.cos(angle)*radius,y:cy+Math.sin(angle)*radius});
  });
  container.innerHTML='';
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 '+width+' '+height);
  svg.setAttribute('width','100%');svg.setAttribute('height','100%');
  svg.style.cssText='display:block';
  const defs=document.createElementNS('http://www.w3.org/2000/svg','defs');
  const marker=document.createElementNS('http://www.w3.org/2000/svg','marker');
  marker.id='gem-arrow';marker.setAttribute('viewBox','0 0 10 10');marker.setAttribute('refX','9');marker.setAttribute('refY','5');marker.setAttribute('markerWidth','5');marker.setAttribute('markerHeight','5');marker.setAttribute('orient','auto-start-reverse');
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M 0 0 L 10 5 L 0 10 z');path.setAttribute('fill','#4f858b');marker.appendChild(path);defs.appendChild(marker);svg.appendChild(defs);
  edges.forEach(edge=>{
    const a=positions.get(edge.from),b=positions.get(edge.to);if(!a||!b)return;
    const line=document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',a.x);line.setAttribute('y1',a.y);line.setAttribute('x2',b.x);line.setAttribute('y2',b.y);
    line.setAttribute('stroke','rgba(80,145,151,.7)');line.setAttribute('stroke-width','1.2');line.setAttribute('marker-end','url(#gem-arrow)');svg.appendChild(line);
    const tx=(a.x+b.x)/2,ty=(a.y+b.y)/2;
    const text=document.createElementNS('http://www.w3.org/2000/svg','text');text.setAttribute('x',tx);text.setAttribute('y',ty-4);text.setAttribute('fill','#719398');text.setAttribute('font-size','7');text.setAttribute('text-anchor','middle');text.textContent=edge.label;svg.appendChild(text);
  });
  nodes.forEach(node=>{
    const p=positions.get(node.id);if(!p)return;
    const group=document.createElementNS('http://www.w3.org/2000/svg','g');group.style.cursor='pointer';group.addEventListener('click',()=>onSelect(node));
    const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');circle.setAttribute('cx',p.x);circle.setAttribute('cy',p.y);circle.setAttribute('r',node.id===seedId?30:24);circle.setAttribute('fill','rgba(4,18,24,.96)');circle.setAttribute('stroke',nodeColor(node.type));circle.setAttribute('stroke-width',node.id===seedId?'2.5':'1.4');group.appendChild(circle);
    const symbol=document.createElementNS('http://www.w3.org/2000/svg','text');symbol.setAttribute('x',p.x);symbol.setAttribute('y',p.y+4);symbol.setAttribute('fill',nodeColor(node.type));symbol.setAttribute('font-size','13');symbol.setAttribute('text-anchor','middle');symbol.textContent=TYPE_SYMBOLS[node.type]||'•';group.appendChild(symbol);
    const label=document.createElementNS('http://www.w3.org/2000/svg','text');label.setAttribute('x',p.x);label.setAttribute('y',p.y+39);label.setAttribute('fill','#e9f4f5');label.setAttribute('font-size','8');label.setAttribute('text-anchor','middle');label.textContent=node.label.slice(0,24);group.appendChild(label);
    const type=document.createElementNS('http://www.w3.org/2000/svg','text');type.setAttribute('x',p.x);type.setAttribute('y',p.y+49);type.setAttribute('fill','#67878c');type.setAttribute('font-size','6.5');type.setAttribute('text-anchor','middle');type.textContent=TYPE_LABELS[node.type]||node.type.toUpperCase();group.appendChild(type);
    svg.appendChild(group);
  });
  container.appendChild(svg);
}

export function createIntelligenceGraphLayer({ graph=createDemoIntelligenceGraph(), sourceLayers=null }={}) {
  let activeGraph=graph;
  let layersSource=sourceLayers;
  let viewer=null,panel=null,enabled=false,selectedId='location:sample',selected=null;
  return {
    id:'intelligence-graph',name:"God's Eye Intelligence Graph",icon:'◎',source:'GEM · GRAPH',updateInterval:0,
    init(nextViewer){viewer=nextViewer||null;return Boolean(viewer);},
    enable(nextViewer){
      viewer=nextViewer||viewer;if(!viewer?.container)return false;enabled=true;
      if(!panel){
        panel=shell();viewer.container.appendChild(panel);
        panel.querySelector('#gem-graph-close').addEventListener('click',()=>{void this._manager?.setEnabled?.(this.id,false,{origin:'user'});});
        const body=document.createElement('div');body.style.cssText='position:absolute;left:14px;right:14px;top:96px;bottom:14px';panel.appendChild(body);
        this._body=body;
        this._render();
      }
      panel.hidden=false;this._refreshGraph();return true;
    },
    attachDataManager(manager){this._manager=manager||null;},
    setSourceLayers(nextLayers){
      layersSource=nextLayers || null;
      this._refreshGraph();
    },
    _refreshGraph(){
      if(layersSource){
        const next=buildIntelligenceGraphFromLayers(layersSource);
        activeGraph=next.nodes.length ? next : createDemoIntelligenceGraph();
      }
      if(!activeGraph.getNode(selectedId)) selectedId=activeGraph.nodes[0]?.id || '';
      selected=activeGraph.getNode(selectedId);
      this._render();
    },
    _render(){
      if(!this._body)return;
      const summary=panel?.querySelector('#gem-graph-summary');
      const stats=activeGraph.stats();
      if(summary)summary.textContent=`${stats.nodes} NODES · `${stats.edges} RELATIONSHIPS · DEPTH 2 · LIVE SOURCES`;
      renderGraphSvg(this._body,activeGraph,selectedId,(node)=>{selectedId=node.id;selected=node;this._render();});
    },
    disable(){enabled=false;if(panel)panel.hidden=true;return true;},
    update(){if(!enabled)return true;this._refreshGraph();return true;},
    destroy(){enabled=false;panel?.remove?.();panel=null;viewer=null;this._manager=null;},
    getStats(){return {enabled,nodes:activeGraph.nodes.length,edges:activeGraph.edges.length,selected:selected?.id||selectedId,live:Boolean(layersSource)};},
    getRowControls(){return {readout:`${activeGraph.nodes.length} nodes / ${activeGraph.edges.length} edges`};},
  };
}
