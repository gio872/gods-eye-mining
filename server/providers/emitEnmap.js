const CMR_GRANULES='https://cmr.earthdata.nasa.gov/search/granules.json';
const APPEEARS_API='https://appeears.earthdatacloud.nasa.gov/api/';
const EMIT_PRODUCT='EMITL2BMIN.001';
const EMIT_MISSION_START='08-09-2022';
const EMIT_MINERAL_MATRIX='https://raw.githubusercontent.com/emit-sds/emit-sds-l2b/develop/data/mineral_grouping_matrix_20230503.csv';
const ENMAP_STAC='https://geoservice.dlr.de/eoc/ogc/stac/v1';
const ENMAP_L2A_COLLECTION='ENMAP_HSI_L2A';
const REQUEST_TIMEOUT_MS=20000;
const cache=new Map();

function finite(v){const n=Number(v);return Number.isFinite(n)?n:null;}
function clean(v){return String(v??'').trim();}
function clamp(v,min=0,max=1){return Math.max(min,Math.min(max,v));}
function validatePoint(lat,lon){
  const latitude=finite(lat),longitude=finite(lon);
  if(latitude===null||longitude===null||latitude<-90||latitude>90||longitude<-180||longitude>180)throw new Error('Coordenadas inválidas');
  return {lat:latitude,lon:longitude};
}
function cacheGet(key){const hit=cache.get(key);if(!hit||Date.now()-hit.at>15*60*1000){cache.delete(key);return null;}return hit.value;}
function cacheSet(key,value){cache.set(key,{at:Date.now(),value});return value;}
async function jsonFetch(url,options={}){
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error('HTTP '+response.status);
  if(payload?.error)throw new Error(payload.error.message||payload.error.details?.join('; ')||'Upstream error');
  return payload;
}
function authToken(){return clean(process.env.APPEEARS_TOKEN||'')||null;}
async function appeearsJson(path,options={}){
  const token=authToken();
  if(!token)throw new Error('Falta APPEEARS_TOKEN en el servidor.');
  const response=await fetch(APPEEARS_API+path,{...options,signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS),headers:{Accept:'application/json',Authorization:'Bearer '+token,...(options.headers||{})}});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error('AppEEARS HTTP '+response.status+' '+clean(payload?.message||payload?.error||''));
  return payload;
}
async function appeearsText(path){
  const token=authToken();
  if(!token)throw new Error('Falta APPEEARS_TOKEN en el servidor.');
  const response=await fetch(APPEEARS_API+path,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)});
  if(!response.ok)throw new Error('AppEEARS bundle HTTP '+response.status);
  return response.text();
}
function parseCsvRow(line){
  const out=[];let field='',quoted=false;
  for(let i=0;i<line.length;i++){const ch=line[i],next=line[i+1];
    if(ch==='"'&&quoted&&next==='"'){field+='"';i++;continue;}
    if(ch==='"'){quoted=!quoted;continue;}
    if(ch===','&&!quoted){out.push(field);field='';continue;}
    field+=ch;
  }
  out.push(field);return out;
}
function parseCsv(text){
  const lines=String(text||'').split(/\r?\n/).filter((line)=>line.length);
  if(!lines.length)return [];
  const headers=parseCsvRow(lines[0]).map((v)=>v.replace(/^\uFEFF/,'').trim());
  return lines.slice(1).map((line)=>{const values=parseCsvRow(line),row={};headers.forEach((h,i)=>{row[h]=values[i]??'';});return row;}).filter((row)=>Object.values(row).some((v)=>String(v).trim()!==''));
}
async function emitMineralNameMap(){
  const key='emit-mineral-name-map',hit=cacheGet(key);if(hit)return hit;
  try{
    const response=await fetch(EMIT_MINERAL_MATRIX,{headers:{Accept:'text/csv'},signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)});
    const text=await response.text();if(!response.ok)throw new Error('EMIT mineral matrix HTTP '+response.status);
    const rows=parseCsv(text),map={};
    for(const row of rows){const id=clean(row.Index||row.index);const name=clean(row.Name||row.name);if(id)map[id]=name||('Mineral ID '+id);}
    return cacheSet(key,map);
  }catch{return cacheSet(key,{});}
}
async function emitCoverage(lat,lon){
  const point=validatePoint(lat,lon);
  const params=new URLSearchParams({short_name:'EMITL2BMIN',version:'001',point:point.lon+','+point.lat,page_size:'10',sort_key:'-start_date'});
  const payload=await jsonFetch(CMR_GRANULES+'?'+params.toString(),{headers:{Accept:'application/json'}});
  const granules=(payload?.feed?.entry||[]).map((entry)=>({
    id:entry.id||null,title:entry.title||null,timeStart:entry.time_start||null,timeEnd:entry.time_end||null,
    updated:entry.updated||null,bbox:entry.bounding_box||null,granuleSizeMB:finite(entry.granule_size),
    links:(entry.links||[]).filter((link)=>link?.href).slice(0,14).map((link)=>({href:link.href,rel:link.rel||null,type:link.type||null,description:link.description||null}))
  }));
  return {point,count:granules.length,granules,source:CMR_GRANULES};
}
async function emitPoint({lat,lon,start=EMIT_MISSION_START,end=new Date().toISOString().slice(0,10)}){
  const point=validatePoint(lat,lon);
  const params={
    dates:[{startDate:start,endDate:end}],
    layers:[
      {product:EMIT_PRODUCT,layer:'group_1_mineral_id'},
      {product:EMIT_PRODUCT,layer:'group_1_band_depth'},
      {product:EMIT_PRODUCT,layer:'group_2_mineral_id'},
      {product:EMIT_PRODUCT,layer:'group_2_band_depth'},
    ],
    coordinates:[{id:'GEM-EMIT',latitude:point.lat,longitude:point.lon,category:'GEM'}],
  };
  const task=await appeearsJson('task',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task_type:'point',task_name:'GEM EMIT '+Date.now(),params})});
  const taskId=clean(task?.task_id||task?.id);if(!taskId)throw new Error('AppEEARS no devolvió task_id');
  const deadline=Date.now()+110000;let status=null;
  while(Date.now()<deadline){
    await new Promise((resolve)=>setTimeout(resolve,4000));
    status=await appeearsJson('task/'+encodeURIComponent(taskId));
    const state=clean(status?.status).toLowerCase();
    if(state==='done')break;
    if(state==='error'||state==='failed')throw new Error('AppEEARS task '+state+(status?.message?': '+status.message:''));
  }
  if(clean(status?.status).toLowerCase()!=='done')return {taskId,status:status?.status||'timeout',pending:true,point,product:EMIT_PRODUCT};
  const bundle=await appeearsJson('bundle/'+encodeURIComponent(taskId));
  const files=Array.isArray(bundle?.files)?bundle.files:[];
  const csvFile=files.find((file)=>/\.csv$/i.test(clean(file?.file_name)));
  if(!csvFile)throw new Error('AppEEARS terminó pero no entregó un CSV de punto.');
  const rows=parseCsv(await appeearsText('bundle/'+encodeURIComponent(taskId)+'/'+encodeURIComponent(csvFile.file_id)));
  const names=await emitMineralNameMap();
  const row=rows[0]||{};
  const value=(...keys)=>{for(const key of keys){if(row[key]!==undefined&&String(row[key]).trim()!=='')return row[key];}return null;};
  const id1=clean(value('group_1_mineral_id')),id2=clean(value('group_2_mineral_id'));
  const bd1=finite(value('group_1_band_depth')),bd2=finite(value('group_2_band_depth'));
  const minerals=[
    {group:1,id:id1,name:names[id1]||null,bandDepth:bd1},
    {group:2,id:id2,name:names[id2]||null,bandDepth:bd2},
  ].filter((item)=>item.id&&item.id!=='0');
  const depths=[bd1,bd2].filter((v)=>v!==null&&v>0);
  const spectralScore=depths.length?clamp(Math.max(...depths)/0.15):0;
  return {
    taskId,status:'done',point,product:EMIT_PRODUCT,minerals,bandDepth:{group1:bd1,group2:bd2},
    spectralScore,row,generatedAt:new Date().toISOString(),
    source:{appeears:APPEEARS_API,cmr:CMR_GRANULES,doi:'https://doi.org/10.5067/EMIT/EMITL2BMIN.001'},
    caveat:'EMITL2BMIN identifies surface minerals with band-depth matching; NASA/LP DAAC states that resource-exploration use requires further validation. It is not direct proof of buried gold, grade or tonnage.'
  };
}
async function enmapPoint(lat,lon){
  const point=validatePoint(lat,lon);
  const delta=.03;
  const url=ENMAP_STAC+'/collections/'+ENMAP_L2A_COLLECTION+'/items?bbox='+encodeURIComponent([point.lon-delta,point.lat-delta,point.lon+delta,point.lat+delta].join(','))+'&limit=12';
  const payload=await jsonFetch(url,{headers:{Accept:'application/geo+json'}});
  const items=(payload?.features||[]).slice(0,12).map((item)=>({
    id:item.id||null,datetime:item.properties?.datetime||null,cloudCover:finite(item.properties?.['eo:cloud_cover']),bbox:item.bbox||null,geometry:item.geometry||null,
    crs:item.properties?.crs||item.properties?.proj_epsg||null,
    assets:Object.fromEntries(Object.entries(item.assets||{}).map(([key,a])=>[key,{href:a?.href||null,title:a?.title||null,type:a?.type||null}]))
  }));
  return {point,collection:ENMAP_L2A_COLLECTION,count:items.length,items,source:ENMAP_STAC,caveat:'EnMAP L2A STAC is publicly discoverable, but current DLR documentation states that L2A download/access requires an authorized account.'};
}
export function emitEnmapProxy(){
  const install=(server)=>{
    server.middlewares.use('/api/emit-enmap',async(req,res)=>{
      const reply=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
      try{
        if(req.method!=='GET')return reply(405,{error:'GET required'});
        const url=new URL(req.url||'http://localhost','http://localhost');
        if(url.pathname==='/emit-coverage')return reply(200,await emitCoverage(url.searchParams.get('lat'),url.searchParams.get('lon')));
        if(url.pathname==='/emit-point')return reply(200,await emitPoint({lat:url.searchParams.get('lat'),lon:url.searchParams.get('lon'),start:clean(url.searchParams.get('start'))||EMIT_MISSION_START,end:clean(url.searchParams.get('end'))||new Date().toISOString().slice(0,10)}));
        if(url.pathname==='/enmap-point')return reply(200,await enmapPoint(url.searchParams.get('lat'),url.searchParams.get('lon')));
        if(url.pathname==='/status')return reply(200,{emitAppEEARS:Boolean(authToken()),emitProduct:EMIT_PRODUCT,enmapL2AStac:true,enmapDataAccess:'authorized-account'});
        return reply(404,{error:'Not found'});
      }catch(error){console.error('[EMIT/EnMAP]',error?.message||String(error));return reply(502,{error:'EMIT/EnMAP query failed',detail:String(error?.message||error).slice(0,600)});}
    });
  };
  return {name:'emit-enmap',configureServer:install,configurePreviewServer:install};
}
