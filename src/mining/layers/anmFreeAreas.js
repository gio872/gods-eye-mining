import * as Cesium from 'cesium';
import { createAnmFreeAreasSource } from '../sources/anmFreeAreasSource.js';

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, function(c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
function n(value) { const x = Number(value); return Number.isFinite(x) ? x : null; }
function ha(value) { return Number.isFinite(Number(value)) ? Number(value).toLocaleString('es-CO', { maximumFractionDigits: 2 }) : '—'; }
function ringPositions(ring) { return Array.isArray(ring) ? ring.filter(function(p){return Array.isArray(p)&&n(p[0])!==null&&n(p[1])!==null;}).map(function(p){return Cesium.Cartesian3.fromDegrees(Number(p[0]),Number(p[1]),0);}) : []; }
function hierarchy(geometry) { const rings = Array.isArray(geometry?.rings) ? geometry.rings.map(ringPositions).filter(function(r){return r.length>=4;}) : []; return rings.length ? new Cesium.PolygonHierarchy(rings[0], rings.slice(1).map(function(r){return new Cesium.PolygonHierarchy(r);})):null; }
function rect(geometry) { const pairs = Array.isArray(geometry?.rings) ? geometry.rings.flat().filter(function(p){return Array.isArray(p)&&n(p[0])!==null&&n(p[1])!==null;}) : []; if(!pairs.length)return null; return Cesium.Rectangle.fromDegrees(Math.min.apply(null,pairs.map(function(p){return Number(p[0]);})),Math.min.apply(null,pairs.map(function(p){return Number(p[1]);})),Math.max.apply(null,pairs.map(function(p){return Number(p[0]);})),Math.max.apply(null,pairs.map(function(p){return Number(p[1]);}))); }

export function createAnmFreeAreasLayer({ source = createAnmFreeAreasSource() } = {}) {
  let viewer=null, panel=null, dataManager=null, dataSource=null, enabled=false, destroyed=false, rowControlsListener=null;
  let departments=[], municipalities=[], currentResult=null;

  function clearMap(){ dataSource?.entities?.removeAll?.(); }
  function paint(){
    clearMap(); if(!currentResult||!dataSource)return;
    for(const cell of currentResult.cells||[]){
      const h=hierarchy(cell.geometry); if(!h)continue;
      dataSource.entities.add({
        id:'gem-anm-free-cell:'+cell.cellKey,
        polygon:{hierarchy:h,material:Cesium.Color.fromCssColorString('#2fe0b3').withAlpha(.25),outline:true,outlineColor:Cesium.Color.fromCssColorString('#2fe0b3').withAlpha(.85),outlineWidth:1,heightReference:Cesium.HeightReference.CLAMP_TO_GROUND},
        properties:{cellKey:cell.cellKey,areaHa:cell.areaHa,reasonCode:cell.reasonCode,statusCode:cell.statusCode,reopeningDate:cell.reopeningDate},
      });
    }
    const r=rect(currentResult.municipalityGeometry); if(r)viewer?.camera?.flyTo({destination:r,duration:.8});
  }
  function select(name,placeholder){ const s=document.createElement('select'); s.name=name; s.style.cssText='width:100%;box-sizing:border-box;padding:8px;border:1px solid rgba(47,224,179,.2);border-radius:5px;background:rgba(2,12,17,.9);color:#eef8fa;font:10px monospace'; s.appendChild(new Option(placeholder,'')); return s; }
  function render(){
    const summary=panel?.querySelector('.gem-anm-free-summary'), list=panel?.querySelector('.gem-anm-free-list'); if(!summary||!list)return;
    summary.replaceChildren(); list.replaceChildren(); if(!currentResult)return;
    [['MUNICIPIO',currentResult.municipality.name],['CELDAS DISPONIBLES',String(currentResult.cellCount)],['SUPERFICIE DISPONIBLE',ha(currentResult.totalHa)+' ha'],['CONSULTA',new Date(currentResult.retrievedAt).toLocaleString('es-CO')]].forEach(function(item){ const d=document.createElement('div'); d.style.cssText='display:flex;justify-content:space-between;gap:10px;padding:7px 8px;border:1px solid rgba(255,255,255,.06);border-radius:4px;font-size:8px'; d.innerHTML='<span style="color:#769492">'+esc(item[0])+'</span><strong style="color:#eaf8fa">'+esc(item[1])+'</strong>'; summary.appendChild(d); });
    const heading=document.createElement('div'); heading.style.cssText='margin-top:7px;color:#2fe0b3;font-size:8px;letter-spacing:.1em;font-weight:700'; heading.textContent=(currentResult.truncated?'CELDAS DISPONIBLES · RESULTADO PARCIAL':'CELDAS DISPONIBLES · DETALLE'); list.appendChild(heading);
    for(const cell of (currentResult.cells||[]).slice(0,1000)){ const row=document.createElement('button'); row.type='button'; row.style.cssText='text-align:left;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.025);color:#dceced;border-radius:5px;padding:7px;font:8px monospace;cursor:pointer'; row.innerHTML='<b style="color:#8df1d4">'+esc(cell.cellKey)+'</b> · '+ha(cell.areaHa)+' ha · reason '+esc(cell.reasonCode||'N')+' · '+esc(cell.statusCode||'A')+(cell.reopeningDate?'<br><span style="color:#7f9c9b">Liberación: '+esc(new Date(cell.reopeningDate).toLocaleString('es-CO'))+'</span>':''); row.addEventListener('click',function(){const rr=rect(cell.geometry); if(rr)viewer?.camera?.flyTo({destination:rr,duration:.45});}); list.appendChild(row); }
  }
  function ensurePanel(){
    if(panel||!viewer?.container)return;
    panel=document.createElement('section'); panel.id='terraqueen-anm-free-areas'; panel.style.cssText='position:absolute;top:92px;right:calc(var(--right-rail-x,52px) + 350px);width:min(640px,calc(100vw - 430px));max-height:calc(100vh - 145px);overflow:auto;box-sizing:border-box;padding:15px 16px 12px;color:#eef8fa;background:rgba(3,15,21,.97);border:1px solid rgba(47,224,179,.3);border-radius:11px;box-shadow:0 18px 55px rgba(0,0,0,.58);backdrop-filter:blur(12px);z-index:162;font-family:monospace';
    panel.innerHTML='<header style="display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:10px"><div><div style="font-size:8px;letter-spacing:.16em;color:#2fe0b3;font-weight:700">GEM · ANM · ANNA MINERÍA</div><div style="font:700 18px system-ui,sans-serif;letter-spacing:.06em;margin-top:3px">ÁREAS LIBRES COLOMBIA</div><div style="font-size:8px;letter-spacing:.1em;color:#79aaa1;margin-top:3px">CUADRÍCULA · DISPONIBILIDAD · DEPARTAMENTO · MUNICIPIO</div></div><button type="button" class="gem-anm-free-close" style="width:28px;height:28px;border:1px solid rgba(47,224,179,.25);background:rgba(47,224,179,.06);color:#8df1d4;border-radius:6px;font-size:18px;cursor:pointer">×</button></header><div class="gem-anm-free-controls" style="display:grid;grid-template-columns:1fr 1fr auto;gap:7px;margin-top:11px"></div><div class="gem-anm-free-message" style="min-height:18px;margin-top:7px;font-size:8px;color:#8eb6b0"></div><div class="gem-anm-free-summary" style="margin-top:9px"></div><div class="gem-anm-free-list" style="display:grid;gap:5px;margin-top:9px"></div><div style="margin-top:10px;padding:8px;border:1px solid rgba(242,197,93,.14);border-radius:6px;color:#8fa9aa;font-size:8px;line-height:1.45">ANM: “Disponible” corresponde a CELL_STATUS_CODE = A en la cuadrícula AnnA Minería. Es disponibilidad cartográfica y no certificación jurídica de área libre.</div>';
    viewer.container.appendChild(panel);
    panel.hidden = true;
    const controls=panel.querySelector('.gem-anm-free-controls'), dept=select('department','Departamento'), muni=select('municipality','Municipio'); muni.disabled=true; const btn=document.createElement('button'); btn.type='button'; btn.textContent='CONSULTAR'; btn.style.cssText='border:1px solid rgba(47,224,179,.3);background:rgba(47,224,179,.08);color:#8df1d4;border-radius:5px;padding:7px 10px;font:700 9px monospace;cursor:pointer'; controls.append(dept,muni,btn);
    panel.querySelector('.gem-anm-free-close').onclick=function(e){e.preventDefault();e.stopPropagation();enabled=false;clearMap();if(panel)panel.hidden=true;dataManager?.setEnabled?.('anm-free-areas',false,{origin:'user'});};
    dept.addEventListener('change',function(){ muni.replaceChildren(new Option('Municipio','')); muni.disabled=true; source.listMunicipalities(dept.value).then(function(v){municipalities=v.municipalities||[]; for(const m of municipalities)muni.appendChild(new Option(m.name,m.code)); muni.disabled=false; panel.querySelector('.gem-anm-free-message').textContent=municipalities.length+' municipio(s) cargados';}).catch(function(e){panel.querySelector('.gem-anm-free-message').textContent='ANM: '+e.message;}); });
    btn.addEventListener('click',function(){ if(!dept.value||!muni.value){panel.querySelector('.gem-anm-free-message').textContent='Seleccione departamento y municipio.';return;} btn.disabled=true; panel.querySelector('.gem-anm-free-message').textContent='Consultando disponibilidad ANM…'; source.search(dept.value,muni.value).then(function(v){currentResult=v;paint();render();panel.querySelector('.gem-anm-free-message').textContent='Consulta ANM completada · '+v.retrievedAt;}).catch(function(e){currentResult=null;clearMap();render();panel.querySelector('.gem-anm-free-message').textContent='ANM: '+e.message;}).finally(function(){btn.disabled=false;}); });
  }
  return {
    id:'anm-free-areas', name:'Áreas Libres ANM', icon:'◇', source:'ANM · AnnA Minería · Cuadrícula', updateInterval:0, showInTogglePanel:true,
    setRowControlsListener:function(listener){rowControlsListener=typeof listener==='function'?listener:null;},
    getRowControls:function(){return {info:currentResult?currentResult.municipality.name+': '+currentResult.cellCount+' celdas · '+ha(currentResult.totalHa)+' ha':'Buscar áreas disponibles por departamento y municipio',infoTitle:'Disponibilidad cartográfica de celdas AnnA Minería.'};},
    attachDataManager:function(manager){dataManager=manager||null;},
    init:function(nextViewer){viewer=nextViewer||null;if(!viewer)return false;if(!dataSource){dataSource=new Cesium.CustomDataSource('gem-anm-free-areas');viewer.dataSources.add(dataSource);}ensurePanel();return true;},
    enable:function(nextViewer){if(destroyed)return false;viewer=nextViewer||viewer;ensurePanel();enabled=true;if(panel)panel.hidden=false;if(!departments.length){const message=panel?.querySelector('.gem-anm-free-message');if(message)message.textContent='Cargando departamentos ANM…';source.listDepartments().then(function(v){departments=v.departments||[];const dept=panel?.querySelector('[name=department]');if(dept){dept.replaceChildren(new Option('Departamento',''));for(const d of departments)dept.appendChild(new Option(d.name,d.code));}if(message)message.textContent=departments.length+' departamento(s) cargados desde ANM';}).catch(function(e){if(message)message.textContent='ANM: '+e.message;});}return true;},
    disable:function(){enabled=false;clearMap();if(panel)panel.hidden=true;return true;},
    update:function(){return enabled&&!destroyed;},
    destroy:function(){if(destroyed)return;clearMap();if(viewer&&dataSource)viewer.dataSources.remove(dataSource,true);dataSource=null;panel?.remove?.();panel=null;viewer=null;dataManager=null;destroyed=true;},
    getStats:function(){return {enabled:enabled,departmentCount:departments.length,municipalityCount:municipalities.length,cellCount:currentResult?.cellCount||0,totalHa:currentResult?.totalHa||0,truncated:Boolean(currentResult?.truncated),retrievedAt:currentResult?.retrievedAt||null};},
  };
}