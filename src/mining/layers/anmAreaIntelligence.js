import * as Cesium from 'cesium';
import { createAnmAreaIntelligenceSource } from '../sources/anmAreaIntelligenceSource.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  })[c]);
}
function scoreColor(score) {
  if (score>=80) return '#2fe0b3';
  if (score>=60) return '#f2c55d';
  return '#ff6b5f';
}
function categoryColor(id) {
  return ({
    'environmental-excluded':'#ff6b5f','environmental-restricted':'#ffb457',tenure:'#f2c55d',
    communities:'#d18cff','land-restitution':'#a98cff',licenses:'#6fd7ff',opportunities:'#2fe0b3',
    hydrography:'#5fa8ff',infrastructure:'#8bd450',cadastre:'#c2b5a4',
  })[id] || '#67dfe6';
}
function makeDraggable(panel) {
  const header=panel?.querySelector('.gem-anm-intel-header');
  if (!panel||!header) return ()=>{};
  let dragging=false,pointerId=null,offsetX=0,offsetY=0;
  const move=(event)=>{if(!dragging||event.pointerId!==pointerId)return;event.preventDefault();panel.style.left=event.clientX-offsetX+'px';panel.style.top=event.clientY-offsetY+'px';panel.style.right='auto';panel.style.bottom='auto';};
  const stop=(event)=>{if(pointerId!==null&&event.pointerId!==pointerId)return;dragging=false;header.style.cursor='grab';try{header.releasePointerCapture(event.pointerId);}catch{}pointerId=null;};
  const start=(event)=>{if(event.button!==undefined&&event.button!==0)return;if(event.target?.closest?.('button,input,select,option,textarea,a'))return;const rect=panel.getBoundingClientRect();dragging=true;pointerId=event.pointerId;offsetX=event.clientX-rect.left;offsetY=event.clientY-rect.top;panel.style.left=rect.left+'px';panel.style.top=rect.top+'px';panel.style.right='auto';panel.style.bottom='auto';header.style.cursor='grabbing';header.setPointerCapture(event.pointerId);event.preventDefault();};
  header.style.cursor='grab';header.style.touchAction='none';
  header.addEventListener('pointerdown',start);header.addEventListener('pointermove',move);header.addEventListener('pointerup',stop);header.addEventListener('pointercancel',stop);
  return ()=>{header.removeEventListener('pointerdown',start);header.removeEventListener('pointermove',move);header.removeEventListener('pointerup',stop);header.removeEventListener('pointercancel',stop);};
}
export function createAnmAreaIntelligenceLayer({source=createAnmAreaIntelligenceSource()}={}) {
  let viewer=null,panel=null,dataSource=null,selectedArea=null,latest=null,enabled=false,destroyed=false,analyzing=false,rowControlsListener=null,destroyDrag=()=>{},removeAreaListener=()=>{};
  function clearMap(){dataSource?.entities?.removeAll?.();viewer?.scene?.requestRender?.();}
  function paintSamples(report){
    clearMap(); if(!dataSource||!report)return;
    for(const category of report.categories||[]){
      const color=Cesium.Color.fromCssColorString(categoryColor(category.id));
      for(const sample of category.samples||[]){
        const center=sample?.center;
        if(!center||!Number.isFinite(Number(center.lon))||!Number.isFinite(Number(center.lat)))continue;
        dataSource.entities.add({
          position:Cesium.Cartesian3.fromDegrees(Number(center.lon),Number(center.lat),0),
          point:{pixelSize:8,color:color.withAlpha(.9),outlineColor:Cesium.Color.WHITE.withAlpha(.8),outlineWidth:1,heightReference:Cesium.HeightReference.CLAMP_TO_GROUND,disableDepthTestDistance:Number.POSITIVE_INFINITY},
          properties:{category:category.label,count:category.count,attributes:JSON.stringify(sample.attributes||{})},
        });
      }
    }
  }
  function statusText(report){
    if(!report)return 'Marque un Área Libre ANM para iniciar la due diligence.';
    if(analyzing)return 'Consultando capas ANM · análisis espacial en curso…';
    if(report.diagnostics?.partial)return 'ANÁLISIS PARCIAL · algunas capas no respondieron.';
    return 'ANÁLISIS COMPLETO · screening ANM listo.';
  }
  function renderReport(report){
    if(!panel)return;
    const body=panel.querySelector('.gem-anm-intel-body'); if(!body)return;
    body.replaceChildren();
    const status=document.createElement('div');status.textContent=statusText(report);status.style.cssText='padding:7px 9px;border:1px solid rgba(47,224,179,.16);color:#9fc0c2;font-size:9px;line-height:1.35';body.appendChild(status);
    if(!report)return;
    const scoreValue=Number(report.score?.value||0),color=scoreColor(scoreValue);
    const score=document.createElement('div');score.style.cssText='margin-top:8px;padding:12px;border:1px solid '+color+'44;background:'+color+'0d;border-radius:7px';
    score.innerHTML='<div style="font-size:8px;letter-spacing:.12em;color:#78989e">GEM · ANM SCREENING SCORE</div><div style="display:flex;align-items:end;justify-content:space-between;gap:10px;margin-top:3px"><strong style="font:700 30px system-ui,sans-serif;color:'+color+'">'+scoreValue+'<span style="font-size:12px">/100</span></strong><strong style="font-size:9px;text-align:right;color:#eef8fa">'+esc(report.score?.label||'—')+'</strong></div>';
    body.appendChild(score);
    const area=document.createElement('div');area.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:8px';
    [['MUNICIPIO',report.area?.municipality?.name||'—'],['CELDAS',report.area?.cellCount||0],['SUPERFICIE',Number(report.area?.totalHa||0).toLocaleString('es-CO',{maximumFractionDigits:2})+' ha'],['GEOMETRÍA','ENVOLVENTE DE SCREENING']].forEach(([label,value])=>{const item=document.createElement('div');item.style.cssText='padding:7px 8px;border:1px solid rgba(255,255,255,.06);font-size:8px';item.innerHTML='<span style="color:#78989e">'+esc(label)+'</span><br><strong style="color:#eaf8fa">'+esc(value)+'</strong>';area.appendChild(item);});
    body.appendChild(area);
    const list=document.createElement('div');list.style.cssText='display:grid;gap:6px;margin-top:9px';
    for(const category of report.categories||[]){
      const color=categoryColor(category.id),level=category.count>0?(category.severity==='critical'?'ALERTA':'HALLAZGO'):'SIN INTERSECCIÓN';
      const card=document.createElement('section');card.style.cssText='padding:8px 9px;border:1px solid '+color+'2c;background:rgba(255,255,255,.018);border-radius:6px';
      const hits=(category.layers||[]).filter((item)=>Number(item.count)>0).map((item)=>'L'+item.layerId+':'+item.count).slice(0,8).join(' · ');
      card.innerHTML='<div style="display:flex;justify-content:space-between;gap:10px"><strong style="font-size:9px;color:'+color+'">'+esc(category.label)+'</strong><strong style="font-size:9px;color:#eaf8fa">'+(category.count==null?'ERR':category.count)+'</strong></div><div style="margin-top:3px;font-size:8px;color:#7f9a9d">'+esc(level)+(hits?' · '+esc(hits):'')+'</div>';
      list.appendChild(card);
    }
    body.appendChild(list);
    const components=document.createElement('div');components.style.cssText='margin-top:9px;padding:8px;border-top:1px solid rgba(255,255,255,.07);font-size:8px';components.innerHTML='<div style="color:#78989e;letter-spacing:.08em;margin-bottom:5px">FACTORES DEL SCORE</div>'+(report.score?.components||[]).map((item)=>'<div style="display:flex;justify-content:space-between;gap:8px;margin:3px 0"><span>'+esc(item.label)+'</span><strong style="color:'+(item.delta<0?'#ff9a8f':'#8df1d4')+'">'+(item.delta>0?'+':'')+item.delta+'</strong></div>').join('');
    body.appendChild(components);
    if((report.diagnostics?.failedLayers||[]).length){const diag=document.createElement('div');diag.style.cssText='margin-top:8px;padding:8px;border:1px solid rgba(255,107,95,.22);color:#ffb0a8;font-size:8px;line-height:1.4';diag.textContent='Capas con error: '+report.diagnostics.failedLayers.map((item)=>item.layerId+' '+item.layerName).join(', ');body.appendChild(diag);}
    const caveat=document.createElement('div');caveat.style.cssText='margin-top:9px;padding:8px;border:1px solid rgba(242,197,93,.16);color:#93aeb3;font-size:8px;line-height:1.45';caveat.textContent=report.caveat||'';body.appendChild(caveat);
  }
  function ensurePanel(){
    if(panel||!viewer?.container)return;
    panel=document.createElement('section');panel.id='terraqueen-anm-area-intelligence';panel.style.cssText='position:absolute;top:92px;right:calc(var(--right-rail-x,52px) + 350px);width:min(610px,calc(100vw - 430px));max-height:calc(100vh - 145px);overflow:auto;box-sizing:border-box;padding:15px 16px 12px;color:#eef8fa;background:linear-gradient(150deg,rgba(4,17,23,.98),rgba(7,24,30,.96));border:1px solid rgba(32,206,216,.3);border-radius:11px;box-shadow:0 18px 55px rgba(0,0,0,.58);backdrop-filter:blur(12px);z-index:163;font-family:monospace';
    panel.innerHTML='<header class="gem-anm-intel-header" style="display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:10px"><div><div style="font-size:8px;letter-spacing:.16em;color:#2fe0b3;font-weight:700">GEM · ANM · SIGM</div><div style="font:700 18px system-ui,sans-serif;letter-spacing:.05em;margin-top:3px">AREA INTELLIGENCE / DUE DILIGENCE</div><div style="font-size:8px;letter-spacing:.1em;color:#7bdde4;margin-top:3px">TENENCIA · AMBIENTE · COMUNIDADES · AGUA · INFRAESTRUCTURA · OPORTUNIDAD</div></div><button type="button" class="gem-anm-intel-close" style="width:28px;height:28px;border:1px solid rgba(47,224,179,.25);background:rgba(47,224,179,.06);color:#8df1d4;border-radius:6px;font-size:18px;cursor:pointer">×</button></header><div class="gem-anm-intel-toolbar" style="display:flex;gap:7px;margin-top:9px"></div><div class="gem-anm-intel-body" style="margin-top:9px"></div>';
    viewer.container.appendChild(panel);panel.hidden=true;
    const button=document.createElement('button');button.type='button';button.textContent='ANALIZAR ÁREA MARCADA';button.style.cssText='border:1px solid rgba(47,224,179,.3);background:rgba(47,224,179,.08);color:#8df1d4;border-radius:5px;padding:7px 10px;font:700 9px monospace;cursor:pointer';button.addEventListener('click',()=>void runAnalysis());
    panel.querySelector('.gem-anm-intel-toolbar').appendChild(button);
    panel.querySelector('.gem-anm-intel-close').addEventListener('click',()=>{panel.hidden=true;});
    destroyDrag=makeDraggable(panel);renderReport(latest);
  }
  async function runAnalysis(){
    if(analyzing||destroyed)return false;
    if(!selectedArea?.cells?.length){panel.hidden=false;panel.querySelector('.gem-anm-intel-body').textContent='Primero marque un Área Libre ANM.';return false;}
    analyzing=true;panel.hidden=false;renderReport(latest);rowControlsListener?.();
    try { latest=await source.analyze(selectedArea);paintSamples(latest);renderReport(latest);return true; }
    catch(error){latest=null;clearMap();panel.querySelector('.gem-anm-intel-body').textContent='ANM: '+String(error?.message||error);return false;}
    finally {analyzing=false;renderReport(latest);rowControlsListener?.();}
  }
  function onAreaSelected(event){selectedArea=event?.detail||null;latest=null;clearMap();if(panel&&!enabled)panel.hidden=true;rowControlsListener?.();}
  return {
    id:'anm-area-intelligence',name:'ANM Area Intelligence',icon:'◎',source:'ANM · SIGM · Area Due Diligence',updateInterval:0,showInTogglePanel:true,
    setRowControlsListener(listener){rowControlsListener=typeof listener==='function'?listener:null;},
    getRowControls(){
      const available=Boolean(selectedArea?.cells?.length);
      return {
        chips:available?[{id:'analyze-area',label:analyzing?'ANALIZANDO…':'ANALIZAR ÁREA MARCADA',disabled:analyzing,onClick:()=>void runAnalysis()}]:[],
        legend:[{label:'Exclusión',color:'#ff6b5f'},{label:'Restricción',color:'#ffb457'},{label:'Oportunidad',color:'#2fe0b3'}],
        info:latest?'Score '+(latest.score?.value??'—')+'/100 · '+(latest.score?.label||'—'):available?'Área marcada disponible para screening ANM.':'Marque un Área Libre ANM para habilitar el análisis.',
        infoTitle:'Screening espacial por envolvente. No sustituye la verificación jurídica o ambiental de la ANM.',
      };
    },
    init(nextViewer){
      viewer=nextViewer||null;if(!viewer)return false;
      if(!dataSource){dataSource=new Cesium.CustomDataSource('gem-anm-area-intelligence');viewer.dataSources.add(dataSource);}
      ensurePanel();removeAreaListener();
      if(typeof window!=='undefined'){const listener=(event)=>onAreaSelected(event);window.addEventListener('gem:anm-free-area-selected',listener);removeAreaListener=()=>window.removeEventListener('gem:anm-free-area-selected',listener);}
      return true;
    },
    enable(nextViewer){if(destroyed)return false;viewer=nextViewer||viewer;ensurePanel();enabled=true;if(panel)panel.hidden=false;renderReport(latest);return true;},
    disable(){enabled=false;if(panel)panel.hidden=true;clearMap();return true;},
    async update(){return enabled&&!destroyed;},
    destroy(){if(destroyed)return;destroyDrag();removeAreaListener();clearMap();if(dataSource&&viewer?.dataSources?.contains?.(dataSource))viewer.dataSources.remove(dataSource,true);dataSource=null;panel?.remove?.();panel=null;viewer=null;destroyed=true;},
    getStats(){const total=(latest?.categories||[]).reduce((sum,category)=>sum+(Number(category.count)||0),0);return {count:total,countLabel:latest?(latest.score?.value??'—')+'/100':selectedArea?'READY':'—',score:latest?.score?.value??null,label:latest?.score?.label||null,partial:Boolean(latest?.diagnostics?.partial)};},
    getParams(){return {source:'ANM SIGM',analysis:'area-due-diligence',score:latest?.score||null,categories:(latest?.categories||[]).map((category)=>({id:category.id,label:category.label,count:category.count}))};},
  };
}
