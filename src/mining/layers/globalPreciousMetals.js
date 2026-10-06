import * as Cesium from 'cesium';
import { GLOBAL_PRECIOUS_METALS } from '../core/globalPreciousMetalsTypes.js';
import { createGlobalPreciousMetalsSource } from '../sources/globalPreciousMetalsSource.js';

function esc(value){return String(value??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function num(value,digits=2){return Number.isFinite(Number(value))?Number(value).toLocaleString('es-CO',{maximumFractionDigits:digits}):'—';}
function scoreColor(score,alpha=.92){const n=Math.max(0,Math.min(1,Number(score)||0));return Cesium.Color.fromHsl((1-n)*.33,.9,.5,alpha);}
function rectDegrees(viewer){
  const rect=viewer?.camera?.computeViewRectangle?.(viewer.scene.globe.ellipsoid);
  if(!rect)return null;
  const west=Cesium.Math.toDegrees(rect.west),east=Cesium.Math.toDegrees(rect.east),south=Cesium.Math.toDegrees(rect.south),north=Cesium.Math.toDegrees(rect.north);
  if(east-west>90||north-south>70)return null;
  return {west,south,east,north};
}
function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function occurrencesCsv(rows){const h=['ID','NAME','METAL','LATITUDE','LONGITUDE','DEPTH_M','DEPTH_STATUS','STATUS','DEPOSIT_TYPE','GRADE','COUNTRY','REGION','SOURCE','SOURCE_URL'];const lines=rows.map((r)=>[r.id,r.name,r.commodity,r.latitude,r.longitude,r.depthM,r.depthStatus,r.developmentStatus,r.depositType,r.grade,r.country,r.region,r.source,r.sourceUrl].map((v)=>'"'+String(v??'').replace(/"/g,'""')+'"').join(','));return [h.join(','),...lines].join('\r\n');}

export function createGlobalPreciousMetalsLayer({source=createGlobalPreciousMetalsSource()}={}){
  let viewer=null,panel=null,dataSource=null,enabled=false,destroyed=false,loading=false,analyzing=false,commodity='gold',occurrences=[],analysis=null,rowControlsListener=null;
  function clearMap(){dataSource?.entities?.removeAll?.();viewer?.scene?.requestRender?.();}
  function paint(){
    clearMap();if(!dataSource)return;
    for(const row of occurrences.slice(0,2000)){
      const color=scoreColor(row.score);
      const surface=Cesium.Cartesian3.fromDegrees(row.longitude,row.latitude,0);
      dataSource.entities.add({
        id:row.id+'-surface',position:surface,
        point:{pixelSize:6+(Number(row.score)||0)*10,color,outlineColor:Cesium.Color.WHITE.withAlpha(.8),outlineWidth:1,disableDepthTestDistance:Number.POSITIVE_INFINITY},
        label:{text:(row.name||row.commodity).slice(0,34)+' · '+Math.round((row.score||0)*100)+'/100',font:'9px monospace',style:Cesium.LabelStyle.FILL_AND_OUTLINE,outlineWidth:3,fillColor:color,outlineColor:Cesium.Color.BLACK.withAlpha(.9),pixelOffset:new Cesium.Cartesian2(8,-8),disableDepthTestDistance:Number.POSITIVE_INFINITY},
        properties:{name:row.name,commodity:row.commodity,depthM:row.depthM,depthStatus:row.depthStatus,status:row.developmentStatus,depositType:row.depositType,grade:row.grade,country:row.country,region:row.region,source:row.source,sourceUrl:row.sourceUrl},
      });
      if(Number.isFinite(Number(row.depthM))&&Number(row.depthM)>0){
        const underground=Cesium.Cartesian3.fromDegrees(row.longitude,row.latitude,-Number(row.depthM));
        dataSource.entities.add({id:row.id+'-shaft',polyline:{positions:[surface,underground],width:1.5,material:color,depthFailMaterial:color.withAlpha(.7)}});
        dataSource.entities.add({id:row.id+'-depth',position:underground,point:{pixelSize:5,color,disableDepthTestDistance:Number.POSITIVE_INFINITY}});
      }
    }
    if(analysis?.point){
      const p=Cesium.Cartesian3.fromDegrees(analysis.point.lon,analysis.point.lat,0);
      const c=scoreColor(analysis.score,1);
      dataSource.entities.add({id:'gem-global-analysis',position:p,point:{pixelSize:22,color:Cesium.Color.TRANSPARENT,outlineColor:Cesium.Color.WHITE.withAlpha(.95),outlineWidth:3,disableDepthTestDistance:Number.POSITIVE_INFINITY},properties:{score:analysis.score,commodity:analysis.commodity}});
      const bottom=Number(analysis.depth?.estimated?.bottomM);
      if(Number.isFinite(bottom)&&bottom>0){
        const u=Cesium.Cartesian3.fromDegrees(analysis.point.lon,analysis.point.lat,-Math.min(bottom,3000));
        dataSource.entities.add({id:'gem-global-analysis-shaft',polyline:{positions:[p,u],width:4,material:c,depthFailMaterial:c.withAlpha(.8)}});
      }
    }
    viewer?.scene?.requestRender?.();
  }
  function statusText(){return loading?'Consultando fuentes globales…':analyzing?'Analizando geología + ocurrencias + magnetismo…':occurrences.length?occurrences.length+' ocurrencia(s) cargadas':'Use BUSCAR EN VISTA o ANALIZAR PUNTO.';}
  function render(){
    if(!panel)return;
    const body=panel.querySelector('.gem-global-pm-body');if(!body)return;body.replaceChildren();
    const s=document.createElement('div');s.style.cssText='padding:7px 9px;border:1px solid rgba(47,224,179,.16);color:#9fc0c2;font-size:9px';s.textContent=statusText();body.appendChild(s);
    const stats=document.createElement('div');stats.style.cssText='display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:8px';
    [['OCURRENCIAS',occurrences.length],['PROFUNDIDAD CONOCIDA',occurrences.filter((r)=>r.depthStatus==='known').length],['MEJOR SCORE',occurrences.length?Math.round((occurrences[0].score||0)*100)+'/100':'—']].forEach(([l,v])=>{const d=document.createElement('div');d.style.cssText='padding:7px 8px;border:1px solid rgba(255,255,255,.06);font-size:8px';d.innerHTML='<span style="color:#78989e">'+l+'</span><br><strong>'+esc(v)+'</strong>';stats.appendChild(d);});body.appendChild(stats);
    if(analysis){
      const card=document.createElement('section');const score=Math.round((analysis.score||0)*100),c=scoreColor(analysis.score).toCssColorString();card.style.cssText='margin-top:9px;padding:10px;border:1px solid '+c+'55;background:'+c+'0d;border-radius:7px;font-size:9px;line-height:1.45';
      const evidence=(analysis.evidence&&Object.entries(analysis.evidence).filter(([k])=>['macrostrat','emag2'].indexOf(k)<0).map(([k,v])=>k+': '+num(Number(v)*100,0)+'%').join(' · '))||'—';
      const d=analysis.depth||{},estimate=d.estimated||{};
      card.innerHTML='<div style="font-size:8px;color:#78989e;letter-spacing:.1em">GLOBAL TARGET SCREENING</div><strong style="font-size:24px;color:'+c+'">'+score+'/100</strong> · '+esc((analysis.commodity||commodity).toUpperCase())+'<br><span>'+num(analysis.point.lat,5)+', '+num(analysis.point.lon,5)+'</span><br><span>Ocurrencias ≤100 km: '+num(analysis.nearbyOccurrenceCount100Km,0)+' · Próxima: '+(analysis.nearestOccurrence?num(analysis.nearestOccurrence.distanceKm,1)+' km':'—')+'</span><br><span>Profundidad conocida cercana: '+(d.nearestKnownM!=null?num(d.nearestKnownM,0)+' m':'no reportada')+' · Horizonte estimado: '+num(estimate.topM,0)+'–'+num(estimate.bottomM,0)+' m · '+esc(estimate.system||'—')+'</span><br><span>Evidencia: '+esc(evidence)+'</span><br><small style="color:#9db0b3">La profundidad estimada no es una medición; incertidumbre alta.</small>';
      body.appendChild(card);
    }
    const list=document.createElement('div');list.style.cssText='display:grid;gap:5px;margin-top:9px';
    for(const row of occurrences.slice(0,30)){
      const b=document.createElement('button');b.type='button';b.style.cssText='text-align:left;padding:7px 8px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.02);color:#dceced;border-radius:5px;font:8px monospace;cursor:pointer';
      b.innerHTML='<b style="color:'+scoreColor(row.score).toCssColorString()+'">'+esc((row.commodity||'').toUpperCase())+'</b> · '+esc(row.name)+' · '+Math.round((row.score||0)*100)+'/100 · '+(row.depthStatus==='known'?num(row.depthM,0)+' m':'prof. n/d');
      b.addEventListener('click',()=>viewer?.camera?.flyTo({destination:Cesium.Cartesian3.fromDegrees(row.longitude,row.latitude,Math.max(300,Math.min(5000,(row.depthM||500)+400))),duration:.7}));
      list.appendChild(b);
    }
    body.appendChild(list);
    const caveat=document.createElement('div');caveat.style.cssText='margin-top:9px;padding:8px;border:1px solid rgba(242,197,93,.16);color:#93aeb3;font-size:8px;line-height:1.45';caveat.textContent='Fuentes principales: USGS MRDS + datasets especializados de oro/PGE, Macrostrat y NOAA EMAG2. MRDS registra ocurrencias conocidas; fuera de EE. UU. su cobertura es incompleta. GEM separa datos documentados de inferencias predictivas.';body.appendChild(caveat);
  }
  function ensurePanel(){
    if(panel||!viewer?.container)return;
    panel=document.createElement('section');panel.id='terraqueen-global-precious-metals';panel.style.cssText='position:absolute;top:92px;right:calc(var(--right-rail-x,52px) + 350px);width:min(650px,calc(100vw - 430px));max-height:calc(100vh - 145px);overflow:auto;box-sizing:border-box;padding:15px 16px 12px;color:#eef8fa;background:linear-gradient(150deg,rgba(4,17,23,.98),rgba(7,24,30,.96));border:1px solid rgba(32,206,216,.3);border-radius:11px;box-shadow:0 18px 55px rgba(0,0,0,.58);backdrop-filter:blur(12px);z-index:165;font-family:monospace';
    panel.innerHTML='<header style="display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:10px"><div><div style="font-size:8px;letter-spacing:.16em;color:#2fe0b3;font-weight:700">GEM · GLOBAL MINERAL INTELLIGENCE</div><div style="font:700 18px system-ui,sans-serif;margin-top:3px">PRECIOUS METALS / GLOBAL TARGETS</div><div style="font-size:8px;letter-spacing:.09em;color:#7bdde4;margin-top:3px">ORO · PLATA · PGE · COORDENADAS · PROFUNDIDAD · EVIDENCIA</div></div><button type="button" class="gem-global-pm-close" style="width:28px;height:28px;border:1px solid rgba(47,224,179,.25);background:rgba(47,224,179,.06);color:#8df1d4;border-radius:6px;font-size:18px;cursor:pointer">×</button></header><div class="gem-global-pm-toolbar" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-top:10px"></div><div class="gem-global-pm-actions" style="display:flex;gap:6px;margin-top:7px;flex-wrap:wrap"></div><div class="gem-global-pm-body" style="margin-top:9px"></div>';
    viewer.container.appendChild(panel);panel.hidden=true;
    const toolbar=panel.querySelector('.gem-global-pm-toolbar');
    const select=document.createElement('select');select.style.cssText='padding:7px;background:#071820;color:#eef8fa;border:1px solid rgba(32,206,216,.2);border-radius:5px;font:9px monospace';for(const item of GLOBAL_PRECIOUS_METALS)select.appendChild(new Option(item.label,item.id));select.value=commodity;
    const lat=document.createElement('input');lat.type='number';lat.step='0.00001';lat.placeholder='LAT';lat.style.cssText='padding:7px;background:#071820;color:#eef8fa;border:1px solid rgba(32,206,216,.2);border-radius:5px;font:9px monospace';
    const lon=document.createElement('input');lon.type='number';lon.step='0.00001';lon.placeholder='LON';lon.style.cssText=lat.style.cssText;
    const analyze=document.createElement('button');analyze.type='button';analyze.textContent='ANALIZAR PUNTO';analyze.style.cssText='border:1px solid rgba(47,224,179,.3);background:rgba(47,224,179,.08);color:#8df1d4;border-radius:5px;padding:7px 9px;font:700 8px monospace;cursor:pointer';
    toolbar.append(select,lat,lon,analyze);
    const actions=panel.querySelector('.gem-global-pm-actions');
    const view=document.createElement('button');view.type='button';view.textContent='BUSCAR EN VISTA';view.style.cssText=analyze.style.cssText;
    const exportBtn=document.createElement('button');exportBtn.type='button';exportBtn.textContent='EXPORTAR CSV';exportBtn.style.cssText=analyze.style.cssText;
    const clear=document.createElement('button');clear.type='button';clear.textContent='LIMPIAR';clear.style.cssText=analyze.style.cssText;
    actions.append(view,exportBtn,clear);
    select.addEventListener('change',()=>{commodity=select.value;occurrences=[];analysis=null;clearMap();render();});
    analyze.addEventListener('click',async()=>{const latitude=Number(lat.value),longitude=Number(lon.value);if(!Number.isFinite(latitude)||!Number.isFinite(longitude)){panel.querySelector('.gem-global-pm-body').textContent='Introduzca latitud y longitud válidas.';return;}analyzing=true;render();try{analysis=await source.analyzePoint({latitude,longitude,commodity});paint();}catch(error){analysis=null;panel.querySelector('.gem-global-pm-body').textContent='GLOBAL: '+String(error?.message||error);}finally{analyzing=false;render();paint();}});
    view.addEventListener('click',async()=>{const bbox=rectDegrees(viewer);if(!bbox){panel.querySelector('.gem-global-pm-body').textContent='Acerca el mapa: la búsqueda admite una vista de hasta 90° × 70°.';return;}loading=true;render();try{const result=await source.occurrences({bbox,commodity,limit:1500});occurrences=(result.occurrences||[]).sort((a,b)=>(b.score||0)-(a.score||0));paint();}catch(error){panel.querySelector('.gem-global-pm-body').textContent='GLOBAL: '+String(error?.message||error);}finally{loading=false;render();}});
    exportBtn.addEventListener('click',()=>{if(!occurrences.length){panel.querySelector('.gem-global-pm-body').textContent='No hay ocurrencias cargadas.';return;}download('GEM_global_precious_metals.csv',occurrencesCsv(occurrences),'text/csv;charset=utf-8');});
    clear.addEventListener('click',()=>{occurrences=[];analysis=null;clearMap();render();});
    panel.querySelector('.gem-global-pm-close').addEventListener('click',()=>{panel.hidden=true;});
  }
  return {
    id:'global-precious-metals',name:'Global Precious Metals Intelligence',icon:'◇',source:'USGS · Macrostrat · NOAA EMAG2 · Global Screening',updateInterval:0,showInTogglePanel:true,
    setRowControlsListener(listener){rowControlsListener=typeof listener==='function'?listener:null;},
    getRowControls(){return {chips:[{id:'global-pm-open',label:'GLOBAL PRECIOUS METALS',onClick:()=>{ensurePanel();panel.hidden=false;render();}}],legend:[{label:'Documented occurrence score',color:'#2fe0b3'}],info:analysis?'Target '+Math.round((analysis.score||0)*100)+'/100':occurrences.length?occurrences.length+' ocurrencias globales':'Analizar cualquier coordenada del planeta',infoTitle:'Datos documentados y screening predictivo se mantienen separados.'};},
    init(nextViewer){viewer=nextViewer||null;if(!viewer)return false;if(!dataSource){dataSource=new Cesium.CustomDataSource('gem-global-precious-metals');viewer.dataSources.add(dataSource);}ensurePanel();return true;},
    enable(nextViewer){if(destroyed)return false;viewer=nextViewer||viewer;ensurePanel();enabled=true;panel.hidden=false;render();paint();return true;},
    disable(){enabled=false;if(panel)panel.hidden=true;clearMap();return true;},
    async update(){return enabled&&!destroyed;},
    destroy(){if(destroyed)return;clearMap();if(dataSource&&viewer?.dataSources?.contains?.(dataSource))viewer.dataSources.remove(dataSource,true);dataSource=null;panel?.remove?.();panel=null;viewer=null;destroyed=true;},
    getStats(){return {count:occurrences.length,countLabel:occurrences.length?occurrences.length+' OCCURRENCES':'—',analysisScore:analysis?.score??null,knownDepths:occurrences.filter((r)=>r.depthStatus==='known').length};},
    getParams(){return {commodity,source:'USGS MRDS + specialized USGS datasets + Macrostrat + NOAA EMAG2',analysis:analysis,occurrences:occurrences.length};},
  };
}
