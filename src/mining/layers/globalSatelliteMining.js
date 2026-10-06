import * as Cesium from 'cesium';
import { createGlobalSatelliteMiningSource } from '../sources/globalSatelliteMiningSource.js';

function esc(v){return String(v??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);}
function num(v,d=2){return Number.isFinite(Number(v))?Number(v).toLocaleString('es-CO',{maximumFractionDigits:d}):'—';}
function rectDegrees(viewer){const rect=viewer?.camera?.computeViewRectangle?.(viewer.scene.globe.ellipsoid);if(!rect)return null;return {west:Cesium.Math.toDegrees(rect.west),south:Cesium.Math.toDegrees(rect.south),east:Cesium.Math.toDegrees(rect.east),north:Cesium.Math.toDegrees(rect.north)};}
export function createGlobalSatelliteMiningLayer({source=createGlobalSatelliteMiningSource()}={}){
  let viewer=null,panel=null,dataSource=null,enabled=false,destroyed=false,loading=false,collection='sentinel-2-l2a',maxCloud=20,start='2025-01-01',end=new Date().toISOString().slice(0,10),scenes=[],rowControlsListener=null;
  function clearMap(){dataSource?.entities?.removeAll?.();viewer?.scene?.requestRender?.();}
  function paint(){
    clearMap();if(!dataSource)return;
    for(const scene of scenes.slice(0,25)){
      const coords=scene?.geometry?.coordinates;
      if(scene?.geometry?.type==='Polygon'&&Array.isArray(coords?.[0])){
        const flat=coords[0].map(([lon,lat])=>Cesium.Cartesian3.fromDegrees(Number(lon),Number(lat),0)).filter(Boolean);
        if(flat.length>=3){
          const color=Cesium.Color.fromCssColorString((scene.cloudCover??100)<=10?'#2fe0b3':(scene.cloudCover??100)<=30?'#f2c55d':'#67dfe6');
          dataSource.entities.add({id:'scene-'+scene.id,polygon:{hierarchy:flat,material:color.withAlpha(.08),outline:true,outlineColor:color.withAlpha(.7),heightReference:Cesium.HeightReference.CLAMP_TO_GROUND},properties:{id:scene.id,date:scene.datetime,cloudCover:scene.cloudCover,collection:scene.collection,tile:scene.tile,preview:scene.assets?.rendered_preview||scene.assets?.visual||null}});
        }
      }
    }
    viewer?.scene?.requestRender?.();
  }
  function render(){
    if(!panel)return;const body=panel.querySelector('.gem-gsm-body');if(!body)return;body.replaceChildren();
    const status=document.createElement('div');status.style.cssText='padding:7px 9px;border:1px solid rgba(47,224,179,.16);color:#9fc0c2;font-size:9px;line-height:1.4';status.textContent=loading?'Buscando escenas satelitales…':scenes.length?scenes.length+' escena(s) encontradas':'Búsqueda satelital lista.';body.appendChild(status);
    const info=document.createElement('div');info.style.cssText='margin-top:8px;padding:8px;border:1px solid rgba(32,206,216,.15);font-size:8px;line-height:1.45;color:#8fa9ad';
    info.innerHTML='<strong style="color:#67dfe6">GEM · SATELLITE MINING INTELLIGENCE</strong><br>Sentinel-2/Landsat se consultan por STAC. La capa de referencia minera usa MINE-THE-GAP 2026 y otros inventarios derivados de satélite.<br><strong style="color:#8df1d4">No es una medición directa de oro:</strong> las imágenes satelitales aportan evidencia superficial y contexto; la mineralización en profundidad requiere geofísica, geoquímica o perforación.';
    body.appendChild(info);
    const refs=document.createElement('div');refs.style.cssText='margin-top:8px;display:grid;gap:5px';
    refs.innerHTML='<div style="padding:7px;border:1px solid rgba(255,255,255,.06);font-size:8px"><b>MINE-THE-GAP</b> · mapa global por material + COG</div><div style="padding:7px;border:1px solid rgba(255,255,255,.06);font-size:8px"><b>2026 GLOBAL 80K</b> · Sentinel-2 + TanDEM-X · clasificación de áreas mineras</div>';
    body.appendChild(refs);
    const list=document.createElement('div');list.style.cssText='display:grid;gap:5px;margin-top:9px';
    for(const scene of scenes){
      const row=document.createElement('div');row.style.cssText='padding:8px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.02);font:8px monospace;color:#dceced';
      const preview=scene.assets?.rendered_preview||scene.assets?.visual||null;
      row.innerHTML='<div><b style="color:#2fe0b3">'+esc(scene.collection||collection)+'</b> · '+esc(scene.id||'—')+'</div><div style="color:#8ea7aa;margin-top:3px">'+esc(scene.datetime||'—')+' · nube '+(scene.cloudCover==null?'—':num(scene.cloudCover,1)+'%')+(scene.tile?' · '+esc(scene.tile):'')+'</div>';
      if(preview){const a=document.createElement('a');a.href=preview;a.target='_blank';a.rel='noopener';a.textContent='ABRIR PREVIEW';a.style.cssText='display:inline-block;margin-top:5px;color:#8df1d4;text-decoration:none';row.appendChild(a);}
      if(scene.assets?.red&&scene.assets?.nir08&&scene.assets?.swir16&&scene.assets?.swir22){const d=document.createElement('div');d.style.cssText='margin-top:4px;color:#78989e';d.textContent='BANDAS RGB/NIR/SWIR DISPONIBLES PARA ANÁLISIS ESPECTRAL GEM';row.appendChild(d);}
      list.appendChild(row);
    }
    body.appendChild(list);
  }
  async function search(){
    const bbox=rectDegrees(viewer);if(!bbox||Math.abs(bbox.east-bbox.west)>20||Math.abs(bbox.north-bbox.south)>20){panel.querySelector('.gem-gsm-body').textContent='Acerca el mapa: la consulta satelital está limitada a 20° × 20°.';return false;}
    loading=true;render();rowControlsListener?.();
    try{const result=await source.scenes({bbox,collection,start,end,maxCloud,limit:15});scenes=result.items||[];paint();return true;}
    catch(error){panel.querySelector('.gem-gsm-body').textContent='SATÉLITE: '+String(error?.message||error);return false;}
    finally{loading=false;render();rowControlsListener?.();}
  }
  function ensurePanel(){
    if(panel||!viewer?.container)return;
    panel=document.createElement('section');panel.id='terraqueen-global-satellite-mining';panel.style.cssText='position:absolute;top:92px;right:calc(var(--right-rail-x,52px) + 350px);width:min(680px,calc(100vw - 430px));max-height:calc(100vh - 145px);overflow:auto;box-sizing:border-box;padding:15px 16px 12px;color:#eef8fa;background:linear-gradient(150deg,rgba(4,17,23,.98),rgba(7,24,30,.96));border:1px solid rgba(32,206,216,.3);border-radius:11px;box-shadow:0 18px 55px rgba(0,0,0,.58);backdrop-filter:blur(12px);z-index:166;font-family:monospace';
    panel.innerHTML='<header style="display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:10px"><div><div style="font-size:8px;letter-spacing:.16em;color:#2fe0b3;font-weight:700">GEM · GLOBAL EARTH OBSERVATION</div><div style="font:700 18px system-ui,sans-serif;margin-top:3px">SATELLITE MINING INTELLIGENCE</div><div style="font-size:8px;color:#7bdde4;margin-top:3px">SENTINEL-2 · LANDSAT · MINE-THE-GAP · MINING FOOTPRINTS</div></div><button type="button" class="gem-gsm-close" style="width:28px;height:28px;border:1px solid rgba(47,224,179,.25);background:rgba(47,224,179,.06);color:#8df1d4;border-radius:6px;font-size:18px;cursor:pointer">×</button></header><div class="gem-gsm-toolbar" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-top:10px"></div><div class="gem-gsm-actions" style="display:flex;gap:6px;margin-top:7px"></div><div class="gem-gsm-body" style="margin-top:9px"></div>';
    viewer.container.appendChild(panel);panel.hidden=true;
    const toolbar=panel.querySelector('.gem-gsm-toolbar');
    const select=document.createElement('select');select.style.cssText='padding:7px;background:#071820;color:#eef8fa;border:1px solid rgba(32,206,216,.2);border-radius:5px;font:9px monospace';select.append(new Option('Sentinel-2 L2A','sentinel-2-l2a'),new Option('Landsat C2 L2','landsat-c2-l2'));select.value=collection;
    const cloud=document.createElement('input');cloud.type='number';cloud.min=0;cloud.max=100;cloud.value=maxCloud;cloud.title='Máximo de nubosidad %';cloud.style.cssText=select.style.cssText;
    const startInput=document.createElement('input');startInput.type='date';startInput.value=start;startInput.style.cssText=select.style.cssText;
    const searchButton=document.createElement('button');searchButton.type='button';searchButton.textContent='BUSCAR EN VISTA';searchButton.style.cssText='border:1px solid rgba(47,224,179,.3);background:rgba(47,224,179,.08);color:#8df1d4;border-radius:5px;padding:7px 9px;font:700 8px monospace;cursor:pointer';
    toolbar.append(select,cloud,startInput,searchButton);
    const actions=panel.querySelector('.gem-gsm-actions');const clear=document.createElement('button');clear.type='button';clear.textContent='LIMPIAR';clear.style.cssText=searchButton.style.cssText;actions.append(clear);
    select.addEventListener('change',()=>{collection=select.value;scenes=[];clearMap();render();});
    cloud.addEventListener('change',()=>{maxCloud=Math.max(0,Math.min(100,Number(cloud.value)||20));});
    startInput.addEventListener('change',()=>{start=startInput.value||'2025-01-01';});
    searchButton.addEventListener('click',()=>void search());
    clear.addEventListener('click',()=>{scenes=[];clearMap();render();});
    panel.querySelector('.gem-gsm-close').addEventListener('click',()=>{panel.hidden=true;});
  }
  return {
    id:'global-satellite-mining',name:'Global Satellite Mining Intelligence',icon:'⌁',source:'Planetary Computer · Sentinel-2/Landsat · MINE-THE-GAP',updateInterval:0,showInTogglePanel:true,
    setRowControlsListener(listener){rowControlsListener=typeof listener==='function'?listener:null;},
    getRowControls(){return {chips:[{id:'global-satellite-mining-open',label:'SATELLITE MINING INTELLIGENCE',onClick:()=>{ensurePanel();panel.hidden=false;render();}}],legend:[{label:'Satellite scene footprint',color:'#2fe0b3'}],info:scenes.length?scenes.length+' escenas satelitales':'Conectar EO global + minería',infoTitle:'Escenas satelitales y productos mineros derivados de observación terrestre.'};},
    init(nextViewer){viewer=nextViewer||null;if(!viewer)return false;if(!dataSource){dataSource=new Cesium.CustomDataSource('gem-global-satellite-mining');viewer.dataSources.add(dataSource);}ensurePanel();return true;},
    enable(nextViewer){if(destroyed)return false;viewer=nextViewer||viewer;ensurePanel();enabled=true;panel.hidden=false;render();return true;},
    disable(){enabled=false;if(panel)panel.hidden=true;clearMap();return true;},
    async update(){return enabled&&!destroyed;},
    destroy(){if(destroyed)return;clearMap();if(dataSource&&viewer?.dataSources?.contains?.(dataSource))viewer.dataSources.remove(dataSource,true);dataSource=null;panel?.remove?.();panel=null;viewer=null;destroyed=true;},
    getStats(){return {count:scenes.length,countLabel:scenes.length?scenes.length+' SCENES':'—',collection,cloudMax:maxCloud};},
    getParams(){return {source:'Microsoft Planetary Computer STAC',collection,maxCloud,start,end,mineTheGapCog:'https://maps.minethegap.eu/assets/data/material_areas_km2-20251227.tif'}},
  };
}
