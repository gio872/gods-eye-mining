import * as Cesium from 'cesium';
import { createGeophysicsEngine } from '../core/geophysicsEngine.js';
import { ingestGeophysicalFile, serializeObservationsToGeoJson } from '../sources/geophysicsSource.js';
import { MOVIN_MARINE_M2_REFERENCE } from '../data/movinMarineReference.js';
import { createMovinMarineSource } from '../sources/movinMarineSource.js';

function esc(value){return String(value??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function number(value,digits=2){return Number.isFinite(Number(value))?Number(value).toLocaleString('es-CO',{maximumFractionDigits:digits}):'—';}
function scoreColor(score,alpha=1){const n=Math.min(1,Math.max(0,Number(score)||0));return Cesium.Color.fromHsl((1-n)*0.33,0.92,0.5,alpha);}
function boundsOfArea(area){
  const boxes=(area?.cells||[]).map((cell)=>cell.bounds).filter((b)=>[b?.west,b?.south,b?.east,b?.north].every((v)=>Number.isFinite(Number(v))));
  if(!boxes.length)return null;
  return {west:Math.min(...boxes.map((b)=>Number(b.west))),south:Math.min(...boxes.map((b)=>Number(b.south))),east:Math.max(...boxes.map((b)=>Number(b.east))),north:Math.max(...boxes.map((b)=>Number(b.north)))};
}
function inside(point,bbox){return !bbox||((point.longitude>=bbox.west&&point.longitude<=bbox.east&&point.latitude>=bbox.south&&point.latitude<=bbox.north));}
function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function csvValue(value){const text=String(value??'');return '"'+text.replace(/"/g,'""')+'"';}
function targetsCsv(rows){const headers=['ID','MINERAL','LATITUDE','LONGITUDE','DEPTH_M','SCORE','ANOMALY_SCORE','CONFIDENCE','MODALITY','VALUE','UNIT','DIRECTION_DEG','SOURCE','SURVEY_DATE'];const body=rows.map((row)=>[row.id,row.mineral,row.latitude,row.longitude,row.depthM,row.score,row.anomalyScore,row.confidence,row.modality,row.value,row.unit,row.directionDeg,row.source,row.surveyDate].map(csvValue).join(','));return [headers.join(','),...body].join('\r\n');}
function targetsGeoJson(rows){return JSON.stringify({type:'FeatureCollection',name:'GEM Ranked Subsurface Targets',features:rows.map((row)=>({type:'Feature',properties:{id:row.id,mineral:row.mineral,depthM:row.depthM,score:row.score,anomalyScore:row.anomalyScore,confidence:row.confidence,modality:row.modality,value:row.value,unit:row.unit,directionDeg:row.directionDeg,source:row.source,surveyDate:row.surveyDate},geometry:{type:'Point',coordinates:[row.longitude,row.latitude,row.depthM]}}))},null,2);}

export function createGeophysicsLayer({ movinMarineSource = createMovinMarineSource() } = {}){
  let viewer=null,panel=null,dataSource=null,destroyed=false,enabled=false,rowControlsListener=null,destroyAreaListener=()=>{};
  let observations=[],targets=[],selectedMineral='all',selectedArea=null,liveReference=null,loadingReference=false;

  const engine=createGeophysicsEngine({maxDepthM:MOVIN_MARINE_M2_REFERENCE.specifications.maximumAnalysisDepthM});

  function filteredObservations(){
    const bbox=boundsOfArea(selectedArea);
    return observations.filter((row)=>selectedMineral==='all'||row.mineral===selectedMineral).filter((row)=>inside({latitude:row.latitude,longitude:row.longitude},bbox));
  }
  function clearMap(){dataSource?.entities?.removeAll?.();viewer?.scene?.requestRender?.();}
  function paint(){
    clearMap();
    if(!dataSource)return;
    for(const target of targets.slice(0,500)){
      const surface=Cesium.Cartesian3.fromDegrees(target.longitude,target.latitude,0);
      const underground=Cesium.Cartesian3.fromDegrees(target.longitude,target.latitude,-target.depthM);
      const color=scoreColor(target.score,.92);
      dataSource.entities.add({
        id:target.id+'-shaft',
        polyline:{positions:[surface,underground],width:2,material:color,depthFailMaterial:color.withAlpha(.85)},
      });
      dataSource.entities.add({
        id:target.id,
        position:underground,
        point:{pixelSize:8+target.score*18,color,outlineColor:Cesium.Color.WHITE.withAlpha(.95),outlineWidth:1,disableDepthTestDistance:Number.POSITIVE_INFINITY},
        label:{text:(target.mineral||'unknown').toUpperCase()+' · '+Math.round(target.score*100)+'/100\n'+number(target.depthM,0)+' m',font:'10px monospace',style:Cesium.LabelStyle.FILL_AND_OUTLINE,outlineWidth:3,fillColor:color,outlineColor:Cesium.Color.BLACK.withAlpha(.9),pixelOffset:new Cesium.Cartesian2(10,-8),disableDepthTestDistance:Number.POSITIVE_INFINITY},
        properties:{mineral:target.mineral,depthM:target.depthM,score:target.score,anomalyScore:target.anomalyScore,intensity:target.value,unit:target.unit,modality:target.modality,directionDeg:target.directionDeg,confidence:target.confidence,source:target.source},
      });
      const footprintMeters=20+target.score*80;
      dataSource.entities.add({
        id:target.id+'-surface',
        position:surface,
        point:{pixelSize:4,color:color.withAlpha(.5),outlineColor:color,outlineWidth:1,disableDepthTestDistance:Number.POSITIVE_INFINITY},
      });
      dataSource.entities.add({
        id:target.id+'-footprint',
        position:surface,
        ellipse:{semiMajorAxis:footprintMeters,semiMinorAxis:footprintMeters*0.6,material:color.withAlpha(.08),outline:true,outlineColor:color.withAlpha(.55),height:1,heightReference:Cesium.HeightReference.CLAMP_TO_GROUND},
      });
      if(Number.isFinite(Number(target.directionDeg))){
        const radians=Number(target.directionDeg)*Math.PI/180;
        const latScale=111320;
        const lonScale=111320*Math.max(.01,Math.cos(Number(target.latitude)*Math.PI/180));
        const dLon=(footprintMeters*1.8*Math.sin(radians))/lonScale;
        const dLat=(footprintMeters*1.8*Math.cos(radians))/latScale;
        dataSource.entities.add({
          id:target.id+'-direction',
          polyline:{
            positions:[surface,Cesium.Cartesian3.fromDegrees(target.longitude+dLon,target.latitude+dLat,2)],
            width:3,material:color.withAlpha(.72),clampToGround:true,
          },
        });
      }
    }
    viewer?.scene?.requestRender?.();
  }
  function publish(){
    if(typeof window==='undefined')return;
    window.dispatchEvent(new CustomEvent('gem:geophysical-evidence-updated',{detail:{
      source:'GEM geophysics import',selectedAreaId:selectedArea?.id||null,
      targets:targets.slice(0,500).map((target)=>({id:target.id,latitude:target.latitude,longitude:target.longitude,depthM:target.depthM,score:target.score,mineral:target.mineral,confidence:target.confidence})),
    }}));
  }
  function rank(){
    targets=engine.rank(filteredObservations());
    paint();publish();rowControlsListener?.();render();
  }
  async function refreshReferenceData() {
    if (loadingReference || !movinMarineSource?.snapshot) return false;
    loadingReference = true;
    try {
      liveReference = await movinMarineSource.snapshot();
      render();
      return true;
    } catch {
      return false;
    } finally {
      loadingReference = false;
    }
  }
  function render(){
    if(!panel)return;
    const body=panel.querySelector('.gem-geophysics-body');if(!body)return;
    body.replaceChildren();
    const status=document.createElement('div');
    status.style.cssText='padding:7px 9px;border:1px solid rgba(47,224,179,.16);color:#9fc0c2;font-size:9px;line-height:1.4';
    status.textContent=selectedArea?'FILTRO ANM ACTIVO · '+(selectedArea.municipality?.name||'Área marcada'):'SIN FILTRO ANM · mostrando todas las observaciones importadas';
    body.appendChild(status);
    const stats=document.createElement('div');
    stats.style.cssText='display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-top:8px';
    [['OBSERVACIONES',filteredObservations().length],['TARGETS',targets.length],['PROFUNDIDAD MÁX.',number(Math.max(0,...targets.map((t)=>t.depthM)),0)+' m']].forEach(([l,v])=>{const d=document.createElement('div');d.style.cssText='padding:7px 8px;border:1px solid rgba(255,255,255,.06);font-size:8px';d.innerHTML='<span style="color:#78989e">'+l+'</span><br><strong style="color:#eef8fa">'+esc(v)+'</strong>';stats.appendChild(d);});
    body.appendChild(stats);
    if(targets.length){
      const best=targets[0],bestBox=document.createElement('div');bestBox.style.cssText='margin-top:8px;padding:9px;border:1px solid rgba(242,197,93,.22);background:rgba(242,197,93,.04);border-radius:6px;font-size:9px';
      bestBox.innerHTML='<div style="color:#78989e;font-size:8px;letter-spacing:.1em">BEST SUBSURFACE TARGET</div><strong style="color:#f2c55d">'+esc(best.mineral.toUpperCase())+' · '+Math.round(best.score*100)+'/100</strong><div style="margin-top:3px;color:#c7d9dc">'+number(best.latitude,5)+', '+number(best.longitude,5)+' · profundidad '+number(best.depthM,0)+' m · anomalía '+Math.round(best.anomalyScore*100)+'/100</div>';
      body.appendChild(bestBox);
    }
    const list=document.createElement('div');list.style.cssText='display:grid;gap:5px;margin-top:9px';
    for(const target of targets.slice(0,25)){
      const row=document.createElement('button');row.type='button';row.style.cssText='text-align:left;padding:7px 8px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.02);color:#dceced;border-radius:5px;font:8px monospace;cursor:pointer';
      row.innerHTML='<b style="color:'+scoreColor(target.score).toCssColorString()+'">'+esc((target.mineral||'unknown').toUpperCase())+'</b> · '+Math.round(target.score*100)+'/100 · '+number(target.depthM,0)+' m · '+esc(target.modality);
      row.addEventListener('click',()=>{viewer?.camera?.flyTo({destination:Cesium.Cartesian3.fromDegrees(target.longitude,target.latitude,Math.max(250,Math.min(3000,target.depthM+250))),duration:.6});});
      list.appendChild(row);
    }
    body.appendChild(list);
    const ref=document.createElement('div');ref.style.cssText='margin-top:10px;padding:8px;border:1px solid rgba(32,206,216,.14);color:#89a4aa;font-size:8px;line-height:1.45';
    const referenceStatus=liveReference?.status||'STATIC';
    const keywordText=(liveReference?.keywords||[]).slice(0,12).join(' · ');
    const liveHeadings=[...(liveReference?.pages?.mining?.headings||[]),...(liveReference?.pages?.radar?.headings||[])].filter(Boolean).slice(0,8);
    ref.innerHTML='<strong style="color:#67dfe6">REFERENCIA MOVIN’MARINE · M2</strong><br><span style="color:#8df1d4">'+esc(referenceStatus)+'</span> · Representación declarada: X/Y + Z geofísico, incluyendo conductividad/anomalía y productos 2D/3D con estimaciones de profundidad. Profundidad máxima declarada: '+number(MOVIN_MARINE_M2_REFERENCE.specifications.maximumAnalysisDepthM,0)+' m. Resolución espacial declarada: '+number(MOVIN_MARINE_M2_REFERENCE.specifications.spatialResolutionM,0)+' m.<br><br><strong style="color:#8df1d4">CASOS REPORTADOS</strong><br>'+MOVIN_MARINE_M2_REFERENCE.caseStudies.map((item)=>esc((item.country||'')+' · '+(item.region||'')+' · '+(item.target||item.signal||''))).join('<br>')+(keywordText?'<br><br><span style="color:#78989e">ÍNDICES DETECTADOS EN LA WEB: '+esc(keywordText)+'</span>':'')+(liveHeadings.length?'<br><br><span style="color:#78989e">SECCIONES ACTUALES: '+esc(liveHeadings.join(' · '))+'</span>':'');
    body.appendChild(ref);
  }
  function ensurePanel(){
    if(panel||!viewer?.container)return;
    panel=document.createElement('section');panel.id='terraqueen-geophysics';panel.style.cssText='position:absolute;top:92px;right:calc(var(--right-rail-x,52px) + 350px);width:min(620px,calc(100vw - 430px));max-height:calc(100vh - 145px);overflow:auto;box-sizing:border-box;padding:15px 16px 12px;color:#eef8fa;background:linear-gradient(150deg,rgba(4,17,23,.98),rgba(7,24,30,.96));border:1px solid rgba(32,206,216,.3);border-radius:11px;box-shadow:0 18px 55px rgba(0,0,0,.58);backdrop-filter:blur(12px);z-index:164;font-family:monospace';
    panel.innerHTML='<header class="gem-geophysics-header" style="display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:10px"><div><div style="font-size:8px;letter-spacing:.16em;color:#2fe0b3;font-weight:700">GEM · SUBSURFACE INTELLIGENCE</div><div style="font:700 18px system-ui,sans-serif;letter-spacing:.05em;margin-top:3px">GEOPHYSICS / X-Y-Z TARGETS</div><div style="font-size:8px;letter-spacing:.1em;color:#7bdde4;margin-top:3px">CSV · XYZ · GEOJSON · PROFUNDIDAD · ANOMALÍA · RANKING</div></div><button type="button" class="gem-geophysics-close" style="width:28px;height:28px;border:1px solid rgba(47,224,179,.25);background:rgba(47,224,179,.06);color:#8df1d4;border-radius:6px;font-size:18px;cursor:pointer">×</button></header><div class="gem-geophysics-tools" style="display:grid;grid-template-columns:1fr 1fr auto;gap:7px;margin-top:10px"></div><div class="gem-geophysics-actions" style="display:flex;gap:7px;margin-top:7px"></div><div class="gem-geophysics-message" style="min-height:18px;margin-top:7px;color:#8eb6b0;font-size:8px"></div><div class="gem-geophysics-body" style="margin-top:9px"></div>';
    viewer.container.appendChild(panel);panel.hidden=true;
    const tools=panel.querySelector('.gem-geophysics-tools'),file=document.createElement('input');file.type='file';file.multiple=true;file.accept='.csv,.xyz,.txt,.json,.geojson,text/csv,application/json';file.style.cssText='width:100%;box-sizing:border-box;color:#b9d5d7;font:8px monospace';
    const mineral=document.createElement('select');mineral.style.cssText='padding:7px;background:#071820;color:#eef8fa;border:1px solid rgba(32,206,216,.2);border-radius:5px;font:9px monospace';[['all','TODOS'],['gold','ORO'],['copper','COBRE'],['zinc','ZINC'],['rare-earth-elements','TIERRAS RARAS'],['lithium','LITIO'],['coltan','COLTÁN'],['tantalite','TANTALITA'],['tungsten','TUNGSTENO']].forEach(([v,l])=>mineral.appendChild(new Option(l,v)));
    const rankButton=document.createElement('button');rankButton.type='button';rankButton.textContent='RANKING';rankButton.style.cssText='border:1px solid rgba(47,224,179,.3);background:rgba(47,224,179,.08);color:#8df1d4;border-radius:5px;padding:7px 10px;font:700 9px monospace;cursor:pointer';tools.append(file,mineral,rankButton);
    const actions=panel.querySelector('.gem-geophysics-actions');
    const refreshReference=document.createElement('button');refreshReference.type='button';refreshReference.className='gem-geophysics-refresh-reference';refreshReference.textContent='ACTUALIZAR M2';refreshReference.style.cssText='border:1px solid rgba(103,223,231,.28);background:rgba(103,223,231,.07);color:#9be7ec;border-radius:5px;padding:7px 10px;font:700 9px monospace;cursor:pointer';
    const exportButton=document.createElement('button');exportButton.type='button';exportButton.textContent='EXPORTAR GEOJSON';exportButton.style.cssText=rankButton.style.cssText;
    const reset=document.createElement('button');reset.type='button';reset.textContent='LIMPIAR';reset.style.cssText=rankButton.style.cssText;
    actions.append(exportButton,reset,refreshReference);
    file.addEventListener('change',async()=>{try{const selected=[...(file.files||[])];let imported=[];for(const f of selected)imported.push(...await ingestGeophysicalFile(f));observations=observations.concat(imported);panel.querySelector('.gem-geophysics-message').textContent=imported.length+' observación(es) importadas · pulse RANKING.';rank();}catch(error){panel.querySelector('.gem-geophysics-message').textContent='GEODATA: '+String(error?.message||error);}});
    mineral.addEventListener('change',()=>{selectedMineral=mineral.value;rank();});
    rankButton.addEventListener('click',rank);
    exportButton.addEventListener('click',()=>{if(!observations.length){panel.querySelector('.gem-geophysics-message').textContent='No hay observaciones para exportar.';return;}download('GEM_subsurface_observations.geojson',serializeObservationsToGeoJson(observations),'application/geo+json;charset=utf-8');panel.querySelector('.gem-geophysics-message').textContent='GeoJSON de observaciones exportado.';});
    const targetExport=document.createElement('button');targetExport.type='button';targetExport.textContent='EXPORTAR TARGETS';targetExport.style.cssText=rankButton.style.cssText;actions.appendChild(targetExport);targetExport.addEventListener('click',()=>{if(!targets.length){panel.querySelector('.gem-geophysics-message').textContent='No hay targets rankeados.';return;}download('GEM_ranked_subsurface_targets.csv',targetsCsv(targets),'text/csv;charset=utf-8');download('GEM_ranked_subsurface_targets.geojson',targetsGeoJson(targets),'application/geo+json;charset=utf-8');panel.querySelector('.gem-geophysics-message').textContent='Targets exportados · CSV + GeoJSON.';});
    refreshReference.addEventListener('click',async()=>{if(loadingReference)return;refreshReference.disabled=true;refreshReference.textContent='ACTUALIZANDO…';const ok=await refreshReferenceData();panel.querySelector('.gem-geophysics-message').textContent=ok?'Referencia MovinMarine actualizada: '+(liveReference?.status||'LIVE'):'No se pudo actualizar la referencia MovinMarine.';refreshReference.disabled=false;refreshReference.textContent='ACTUALIZAR M2';});
    reset.addEventListener('click',()=>{observations=[];targets=[];clearMap();publish();render();});
    panel.querySelector('.gem-geophysics-close').addEventListener('click',()=>{panel.hidden=true;});
    void refreshReferenceData();
  }
  function onArea(event){selectedArea=event?.detail||null;rank();}
  return {
    id:'geophysics-subsurface',name:'Geophysics / Subsurface Targets',icon:'∿',source:'GEM · X/Y/Z · Subsurface Intelligence',updateInterval:0,showInTogglePanel:true,
    setRowControlsListener(listener){rowControlsListener=typeof listener==='function'?listener:null;},
    getRowControls(){return {
      chips:[{id:'geophysics-open',label:'GEOPHYSICS X/Y/Z',onClick:()=>{ensurePanel();panel.hidden=false;render();}}],
      legend:[{label:'Target score',color:'#2fe0b3'}],
      info:targets.length?('Targets '+targets.length+' · best '+Math.round((targets[0]?.score||0)*100)+'/100'):(selectedArea?'ANM marcado · listo para importar geofísica':'Importe CSV/XYZ/GeoJSON de campaña'),
      infoTitle:'Los targets provienen de observaciones importadas; la referencia M2 se conserva separada como metadata.',
    };},
    init(nextViewer){viewer=nextViewer||null;if(!viewer)return false;if(!dataSource){dataSource=new Cesium.CustomDataSource('gem-geophysics-subsurface');viewer.dataSources.add(dataSource);}ensurePanel();if(typeof window!=='undefined'){const listener=(event)=>onArea(event);window.addEventListener('gem:anm-free-area-selected',listener);destroyAreaListener=()=>window.removeEventListener('gem:anm-free-area-selected',listener);}return true;},
    enable(nextViewer){if(destroyed)return false;viewer=nextViewer||viewer;ensurePanel();enabled=true;panel.hidden=false;render();return true;},
    disable(){enabled=false;panel&&(panel.hidden=true);clearMap();return true;},
    async update(){return enabled&&!destroyed;},
    destroy(){if(destroyed)return;destroyAreaListener();clearMap();if(dataSource&&viewer?.dataSources?.contains?.(dataSource))viewer.dataSources.remove(dataSource,true);dataSource=null;panel?.remove?.();panel=null;viewer=null;destroyed=true;},
    getStats(){return {count:targets.length,countLabel:targets.length?targets.length+' TARGETS':'—',observations:observations.length,topScore:targets[0]?.score??null,selectedAreaId:selectedArea?.id||null};},
    getParams(){return {source:'GEM geophysical import',acceptedFormats:['CSV','XYZ','GeoJSON'],selectedMineral,selectedAreaId:selectedArea?.id||null,m2Reference:MOVIN_MARINE_M2_REFERENCE,liveReferenceStatus:liveReference?.status||null};},
    getSnapshot(){return Object.freeze({observations:[...observations],targets:[...targets],selectedArea:selectedArea});},
  };
}