import * as Cesium from 'cesium';
import { createAnmFreeAreasSource } from '../sources/anmFreeAreasSource.js';

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, function(c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
function n(value) { const x = Number(value); return Number.isFinite(x) ? x : null; }
function ha(value) { return Number.isFinite(Number(value)) ? Number(value).toLocaleString('es-CO', { maximumFractionDigits: 2 }) : '—'; }
function ringPositions(ring) { return Array.isArray(ring) ? ring.filter(function(p){return Array.isArray(p)&&n(p[0])!==null&&n(p[1])!==null;}).map(function(p){return Cesium.Cartesian3.fromDegrees(Number(p[0]),Number(p[1]),0);}) : []; }
function rect(geometry) { const pairs = Array.isArray(geometry?.rings) ? geometry.rings.flat().filter(function(p){return Array.isArray(p)&&n(p[0])!==null&&n(p[1])!==null;}) : []; if(!pairs.length)return null; return Cesium.Rectangle.fromDegrees(Math.min.apply(null,pairs.map(function(p){return Number(p[0]);})),Math.min.apply(null,pairs.map(function(p){return Number(p[1]);})),Math.max.apply(null,pairs.map(function(p){return Number(p[0]);})),Math.max.apply(null,pairs.map(function(p){return Number(p[1]);}))); }
function cellRect(bounds) { const west=n(bounds?.west), east=n(bounds?.east), south=n(bounds?.south), north=n(bounds?.north); if([west,east,south,north].some(function(v){return v===null;}) || east<=west || north<=south)return null; return Cesium.Rectangle.fromDegrees(west,south,east,north); }
function cellCoordinates(bounds) { const west=n(bounds?.west), east=n(bounds?.east), south=n(bounds?.south), north=n(bounds?.north); if([west,east,south,north].some(function(v){return v===null;})) return null; return [[[west,south],[east,south],[east,north],[west,north],[west,south]]]; }
function csvValue(value) { const text=String(value ?? ''); return '"'+text.replace(/"/g,'""')+'"'; }
function downloadFile(filename, content, type) { const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const anchor=document.createElement('a'); anchor.href=url; anchor.download=filename; anchor.click(); setTimeout(function(){URL.revokeObjectURL(url);},1000); }
function exportForAnm(result) {
  if(!result?.cells?.length) throw new Error('No hay celdas marcadas para exportar');
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const base='ANM_Area_Libre_'+String(result.department?.code||'DEP')+'_'+String(result.municipality?.code||'MPIO')+'_'+stamp;
  const headers=['CELL_KEY_ID','CELL_STATUS_CODE','CELL_REASON_CODE','CELL_REOPENING_DATE','AREA_HA','CENTROID_LONGITUDE','CENTROID_LATITUDE','LONGITUD_MIN','LONGITUD_MAX','LATITUD_MIN','LATITUD_MAX'];
  const rows=result.cells.map(function(cell){return [cell.cellKey,cell.statusCode,cell.reasonCode,cell.reopeningDate||'',cell.areaHa,cell.centroid?.lon,cell.centroid?.lat,cell.bounds?.west,cell.bounds?.east,cell.bounds?.south,cell.bounds?.north].map(csvValue).join(',');});
  const csv=[headers.join(','),...rows].join('\r\n');
  downloadFile(base+'.csv',csv,'text/csv;charset=utf-8');
  const features=result.cells.map(function(cell){return {type:'Feature',properties:{CELL_KEY_ID:cell.cellKey,CELL_STATUS_CODE:cell.statusCode,CELL_REASON_CODE:cell.reasonCode,CELL_REOPENING_DATE:cell.reopeningDate||null,AREA_HA:cell.areaHa,CENTROID_LONGITUDE:cell.centroid?.lon,CENTROID_LATITUDE:cell.centroid?.lat},geometry:{type:'Polygon',coordinates:cellCoordinates(cell.bounds)}};}).filter(function(feature){return feature.geometry.coordinates;});
  const geojson={type:'FeatureCollection',name:base,features:features,metadata:{provider:'ANM · AnnA Minería',department:result.department,municipality:result.municipality,cellCount:result.cellCount,totalHa:result.totalHa,retrievedAt:result.retrievedAt,statusDefinition:'CELL_STATUS_CODE=A → Disponible',note:'GeoJSON operacional de celdas disponibles; verifique el estado vigente en AnnA Minería antes de radicar.'}};
  downloadFile(base+'.geojson',JSON.stringify(geojson,null,2),'application/geo+json;charset=utf-8');
  const cellIds=result.cells.map(function(cell){return cell.cellKey;}).filter(Boolean).join('\\r\\n')+'\r\n';
  downloadFile(base+'_CELL_KEY_ID.txt',cellIds,'text/plain;charset=utf-8');
  const summary=['GEM · EXPORTACIÓN PARA ANM','Fuente: ANM · AnnA Minería · Sistema de Cuadrícula','Departamento: '+(result.department?.name||'—'),'Municipio: '+(result.municipality?.name||'—'),'Código departamento: '+(result.department?.code||'—'),'Código municipio: '+(result.municipality?.code||'—'),'Celdas disponibles: '+result.cellCount,'Superficie total: '+result.totalHa+' ha','Fecha/hora de consulta: '+result.retrievedAt,'Estado consultado: CELL_STATUS_CODE=A','AVISO: este archivo sirve como soporte cartográfico y operativo. La radicación y verificación de disponibilidad se realiza en AnnA Minería.'].join('\\r\\n');
  downloadFile(base+'_RESUMEN.txt',summary,'text/plain;charset=utf-8');
  return base;
}

function makeDraggable(panel) {
  const header = panel?.querySelector('.gem-anm-free-header');
  if (!panel || !header) return () => {};

  let dragging = false;
  let pointerId = null;
  let offsetX = 0;
  let offsetY = 0;

  const clamp = () => {
    const rect = panel.getBoundingClientRect();
    const margin = 8;
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    const left = Math.min(maxLeft, Math.max(margin, rect.left));
    const top = Math.min(maxTop, Math.max(margin, rect.top));
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  };

  const move = (event) => {
    if (!dragging || event.pointerId !== pointerId) return;
    event.preventDefault();
    const left = event.clientX - offsetX;
    const top = event.clientY - offsetY;
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    clamp();
  };

  const stop = (event) => {
    if (pointerId !== null && event.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
    header.style.cursor = 'grab';
    header.classList.remove('dragging');
    try {
      header.releasePointerCapture(event.pointerId);
    } catch {}
  };

  const start = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    const target = event.target;
    if (target?.closest?.('button, input, select, option, textarea, a')) return;

    const rect = panel.getBoundingClientRect();
    if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return;

    dragging = true;
    pointerId = event.pointerId;
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;

    panel.style.left = rect.left + 'px';
    panel.style.top = rect.top + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';

    header.style.cursor = 'grabbing';
    header.classList.add('dragging');
    header.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };

  header.style.cursor = 'grab';
  header.style.touchAction = 'none';
  header.addEventListener('pointerdown', start);
  header.addEventListener('pointermove', move);
  header.addEventListener('pointerup', stop);
  header.addEventListener('pointercancel', stop);
  window.addEventListener('resize', clamp);

  return () => {
    window.removeEventListener('resize', clamp);
    header.removeEventListener('pointerdown', start);
    header.removeEventListener('pointermove', move);
    header.removeEventListener('pointerup', stop);
    header.removeEventListener('pointercancel', stop);
  };
}

export function createAnmFreeAreasLayer({ source = createAnmFreeAreasSource() } = {}) {
  let viewer=null, panel=null, dataManager=null, dataSource=null, enabled=false, destroyed=false, rowControlsListener=null;
  let departments=[], municipalities=[], currentResult=null, selectedArea=null, destroyDrag=()=>{};

  function clearMap(){ dataSource?.entities?.removeAll?.(); }
  function paint(){
    clearMap(); if(!currentResult||!dataSource)return;
    const selectedKeys=new Set((selectedArea?.cells||[]).map(function(cell){return cell.cellKey;}));
    for(const cell of currentResult.cells||[]){
      const rectangle=cellRect(cell.bounds); if(!rectangle)continue;
      dataSource.entities.add({
        id:'gem-anm-free-cell:'+cell.cellKey,
        rectangle:{
          coordinates:rectangle,
          material:(selectedKeys.has(cell.cellKey)?Cesium.Color.fromCssColorString('#f2c55d'):Cesium.Color.fromCssColorString('#2fe0b3')).withAlpha(selectedKeys.has(cell.cellKey)?.34:.20),
          outline:true,
          outlineColor:selectedKeys.has(cell.cellKey)?Cesium.Color.fromCssColorString('#f2c55d').withAlpha(.98):Cesium.Color.fromCssColorString('#2fe0b3').withAlpha(.92),
          outlineWidth:1,
          height:0,
          heightReference:Cesium.HeightReference.CLAMP_TO_GROUND,
        },
        properties:{cellKey:cell.cellKey,areaHa:cell.areaHa,reasonCode:cell.reasonCode,statusCode:cell.statusCode,reopeningDate:cell.reopeningDate},
      });
    }
    viewer?.scene?.requestRender?.();
    const r=rect(currentResult.municipalityGeometry); if(r)viewer?.camera?.flyTo({destination:r,duration:.8});
  }
  function select(name,placeholder){ const s=document.createElement('select'); s.name=name; s.style.cssText='width:100%;box-sizing:border-box;padding:8px;border:1px solid rgba(47,224,179,.2);border-radius:5px;background:rgba(2,12,17,.9);color:#eef8fa;font:10px monospace'; s.appendChild(new Option(placeholder,'')); return s; }
  function render(){
    const summary=panel?.querySelector('.gem-anm-free-summary'), list=panel?.querySelector('.gem-anm-free-list'); if(!summary||!list)return;
    summary.replaceChildren(); list.replaceChildren(); if(!currentResult)return;
    [['MUNICIPIO',currentResult.municipality.name],['CELDAS DISPONIBLES',String(currentResult.cellCount)],['SUPERFICIE DISPONIBLE',ha(currentResult.totalHa)+' ha'],['CONSULTA',new Date(currentResult.retrievedAt).toLocaleString('es-CO')]].forEach(function(item){ const d=document.createElement('div'); d.style.cssText='display:flex;justify-content:space-between;gap:10px;padding:7px 8px;border:1px solid rgba(255,255,255,.06);border-radius:4px;font-size:8px'; d.innerHTML='<span style="color:#769492">'+esc(item[0])+'</span><strong style="color:#eaf8fa">'+esc(item[1])+'</strong>'; summary.appendChild(d); });
    const heading=document.createElement('div'); heading.style.cssText='margin-top:7px;color:#2fe0b3;font-size:8px;letter-spacing:.1em;font-weight:700'; heading.textContent=(currentResult.truncated?'CELDAS DISPONIBLES · RESULTADO PARCIAL':'CELDAS DISPONIBLES · DETALLE'); list.appendChild(heading);
    for(const cell of (currentResult.cells||[]).slice(0,1000)){ const row=document.createElement('button'); row.type='button'; row.style.cssText='text-align:left;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.025);color:#dceced;border-radius:5px;padding:7px;font:8px monospace;cursor:pointer'; row.innerHTML='<b style="color:#8df1d4">'+esc(cell.cellKey)+'</b> · '+ha(cell.areaHa)+' ha · reason '+esc(cell.reasonCode||'N')+' · '+esc(cell.statusCode||'A')+(cell.reopeningDate?'<br><span style="color:#7f9c9b">Liberación: '+esc(new Date(cell.reopeningDate).toLocaleString('es-CO'))+'</span>':''); row.addEventListener('click',function(){const rr=cellRect(cell.bounds); if(rr)viewer?.camera?.flyTo({destination:rr,duration:.45});}); list.appendChild(row); }
  }
  function updateExportButton() {
    const button=panel?.querySelector('.gem-anm-free-export');
    if(button) button.disabled=!selectedArea?.cells?.length;
  }
  function ensurePanel(){
    if(panel||!viewer?.container)return;
    panel=document.createElement('section'); panel.id='terraqueen-anm-free-areas'; panel.style.cssText='position:absolute;top:92px;right:calc(var(--right-rail-x,52px) + 350px);width:min(640px,calc(100vw - 430px));max-height:calc(100vh - 145px);overflow:auto;box-sizing:border-box;padding:15px 16px 12px;color:#eef8fa;background:rgba(3,15,21,.97);border:1px solid rgba(47,224,179,.3);border-radius:11px;box-shadow:0 18px 55px rgba(0,0,0,.58);backdrop-filter:blur(12px);z-index:162;font-family:monospace';
    panel.innerHTML='<header class="gem-anm-free-header" style="display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:10px"><div><div style="font-size:8px;letter-spacing:.16em;color:#2fe0b3;font-weight:700">GEM · ANM · ANNA MINERÍA</div><div style="font:700 18px system-ui,sans-serif;letter-spacing:.06em;margin-top:3px">ÁREAS LIBRES COLOMBIA</div><div style="font-size:8px;letter-spacing:.1em;color:#79aaa1;margin-top:3px">CUADRÍCULA · DISPONIBILIDAD · DEPARTAMENTO · MUNICIPIO</div></div><button type="button" class="gem-anm-free-close" style="width:28px;height:28px;border:1px solid rgba(47,224,179,.25);background:rgba(47,224,179,.06);color:#8df1d4;border-radius:6px;font-size:18px;cursor:pointer">×</button></header><div class="gem-anm-free-controls" style="display:grid;grid-template-columns:1fr 1fr auto;gap:7px;margin-top:11px"></div><div class="gem-anm-free-export-row" style="display:flex;gap:7px;margin-top:7px"></div><div class="gem-anm-free-message" style="min-height:18px;margin-top:7px;font-size:8px;color:#8eb6b0"></div><div class="gem-anm-free-summary" style="margin-top:9px"></div><div class="gem-anm-free-list" style="display:grid;gap:5px;margin-top:9px"></div><div style="margin-top:10px;padding:8px;border:1px solid rgba(242,197,93,.14);border-radius:6px;color:#8fa9aa;font-size:8px;line-height:1.45">ANM: “Disponible” corresponde a CELL_STATUS_CODE = A en la cuadrícula AnnA Minería. Es disponibilidad cartográfica y no certificación jurídica de área libre.</div>';
    viewer.container.appendChild(panel);
    panel.hidden = true;
    const controls=panel.querySelector('.gem-anm-free-controls'), dept=select('department','Departamento'), muni=select('municipality','Municipio'); muni.disabled=true; const btn=document.createElement('button'); btn.type='button'; btn.textContent='CONSULTAR'; btn.style.cssText='border:1px solid rgba(47,224,179,.3);background:rgba(47,224,179,.08);color:#8df1d4;border-radius:5px;padding:7px 10px;font:700 9px monospace;cursor:pointer'; controls.append(dept,muni,btn);
    destroyDrag(); destroyDrag=makeDraggable(panel);
    panel.querySelector('.gem-anm-free-close').onclick=function(e){e.preventDefault();e.stopPropagation();enabled=false;clearMap();if(panel)panel.hidden=true;dataManager?.setEnabled?.('anm-free-areas',false,{origin:'user'});};
    const mark=document.createElement('button'); mark.type='button'; mark.textContent='MARCAR ÁREA LIBRE'; mark.style.cssText=btn.style.cssText; mark.disabled=true; panel.insertBefore(mark,panel.querySelector('.gem-anm-free-message')); const exportButton=document.createElement('button'); exportButton.className='gem-anm-free-export'; exportButton.type='button'; exportButton.textContent='EXPORTAR ÁREA PARA ANM'; exportButton.disabled=true; exportButton.style.cssText=btn.style.cssText; panel.querySelector('.gem-anm-free-export-row').appendChild(exportButton); exportButton.addEventListener('click',function(){try{const name=exportForAnm(selectedArea);panel.querySelector('.gem-anm-free-message').textContent='EXPORTADO · '+name+'.csv + .geojson + _CELL_KEY_ID.txt + _RESUMEN.txt';}catch(e){panel.querySelector('.gem-anm-free-message').textContent='Exportación: '+e.message;}});
    dept.addEventListener('change',function(){ muni.replaceChildren(new Option('Municipio','')); muni.disabled=true; source.listMunicipalities(dept.value).then(function(v){municipalities=v.municipalities||[]; for(const m of municipalities)muni.appendChild(new Option(m.name,m.code)); muni.disabled=false; panel.querySelector('.gem-anm-free-message').textContent=municipalities.length+' municipio(s) cargados';}).catch(function(e){panel.querySelector('.gem-anm-free-message').textContent='ANM: '+e.message;}); });
    mark.addEventListener('click',function(){markArea();});
    btn.addEventListener('click',function(){ if(!dept.value||!muni.value){panel.querySelector('.gem-anm-free-message').textContent='Seleccione departamento y municipio.';return;} btn.disabled=true; panel.querySelector('.gem-anm-free-message').textContent='Consultando disponibilidad ANM…'; source.search(dept.value,muni.value).then(function(v){currentResult=v;selectedArea=null;mark.disabled=!v.cells?.length;updateExportButton();paint();render();panel.querySelector('.gem-anm-free-message').textContent='Consulta ANM completada · '+v.retrievedAt;}).catch(function(e){currentResult=null;clearMap();updateExportButton();render();panel.querySelector('.gem-anm-free-message').textContent='ANM: '+e.message;}).finally(function(){btn.disabled=false;}); });
  }
  function markArea(){
    if(!currentResult?.cells?.length)return;
    selectedArea={
      id:'ANM-FREE-'+currentResult.municipality.code,
      department:currentResult.department,
      municipality:currentResult.municipality,
      cellCount:currentResult.cellCount,
      totalHa:currentResult.totalHa,
      cells:currentResult.cells.map(function(cell){return {cellKey:cell.cellKey,areaHa:cell.areaHa,centroid:cell.centroid,bounds:cell.bounds,reasonCode:cell.reasonCode,statusCode:cell.statusCode,reopeningDate:cell.reopeningDate};}),
      retrievedAt:currentResult.retrievedAt,
      source:currentResult.source,
    };
    paint();
    const box=panel?.querySelector('.gem-anm-free-message');
    if(box)box.textContent='ÁREA MARCADA · '+selectedArea.cellCount+' celdas · '+ha(selectedArea.totalHa)+' ha · LISTA PARA CONSULTA';
    if(typeof window!=='undefined') window.dispatchEvent(new CustomEvent('gem:anm-free-area-selected',{detail:selectedArea}));
    updateExportButton();
    rowControlsListener?.();
  }
  return {
    id:'anm-free-areas', name:'Áreas Libres ANM', icon:'◇', source:'ANM · AnnA Minería · Cuadrícula', updateInterval:0, showInTogglePanel:true,
    setRowControlsListener:function(listener){rowControlsListener=typeof listener==='function'?listener:null;},
    getRowControls:function(){return {info:selectedArea?selectedArea.municipality.name+': ÁREA MARCADA · '+selectedArea.cellCount+' celdas · '+ha(selectedArea.totalHa)+' ha':currentResult?currentResult.municipality.name+': '+currentResult.cellCount+' celdas · '+ha(currentResult.totalHa)+' ha':'Buscar áreas disponibles por departamento y municipio',infoTitle:'Disponibilidad cartográfica de celdas AnnA Minería. El área marcada queda disponible como objetivo de consulta.'};},
    getSelectedArea:function(){return selectedArea;},
    attachDataManager:function(manager){dataManager=manager||null;},
    init:function(nextViewer){viewer=nextViewer||null;if(!viewer)return false;if(!dataSource){dataSource=new Cesium.CustomDataSource('gem-anm-free-areas');viewer.dataSources.add(dataSource);}ensurePanel();return true;},
    enable:function(nextViewer){if(destroyed)return false;viewer=nextViewer||viewer;ensurePanel();enabled=true;if(panel)panel.hidden=false;if(!departments.length){const message=panel?.querySelector('.gem-anm-free-message');if(message)message.textContent='Cargando departamentos ANM…';source.listDepartments().then(function(v){departments=v.departments||[];const dept=panel?.querySelector('[name=department]');if(dept){dept.replaceChildren(new Option('Departamento',''));for(const d of departments)dept.appendChild(new Option(d.name,d.code));}if(message)message.textContent=departments.length+' departamento(s) cargados desde ANM';}).catch(function(e){if(message)message.textContent='ANM: '+e.message;});}return true;},
    disable:function(){enabled=false;clearMap();if(panel)panel.hidden=true;return true;},
    update:function(){return enabled&&!destroyed;},
    destroy:function(){if(destroyed)return;clearMap();if(viewer&&dataSource)viewer.dataSources.remove(dataSource,true);dataSource=null;destroyDrag();destroyDrag=()=>{};panel?.remove?.();panel=null;viewer=null;dataManager=null;destroyed=true;},
    getStats:function(){return {enabled:enabled,departmentCount:departments.length,municipalityCount:municipalities.length,cellCount:currentResult?.cellCount||0,totalHa:currentResult?.totalHa||0,selectedCellCount:selectedArea?.cellCount||0,selectedTotalHa:selectedArea?.totalHa||0,truncated:Boolean(currentResult?.truncated),retrievedAt:currentResult?.retrievedAt||null};},
  };
}