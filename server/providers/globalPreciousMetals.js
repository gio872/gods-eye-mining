const MRDS_URL='https://energy.usgs.gov/arcgis/rest/services/Hosted/Mineral_Resource_Data_System/FeatureServer/0';
const SEDIMENT_GOLD_URL='https://energy.usgs.gov/arcgis/rest/services/Hosted/Sediment_hosted_gold_deposits/FeatureServer/0';
const PGE_URL='https://energy.usgs.gov/arcgis/rest/services/Hosted/PGE_Ni_Cr_deposits_and_occurrence/FeatureServer/0';
const EMAG2_SAMPLES_URL='https://gis.ngdc.noaa.gov/arcgis/rest/services/EMAG2v3/ImageServer/getSamples';
const MACROSTRAT_URL='https://macrostrat.org/api/v2/geologic_units/map';
const MRDS_PAGE='https://mrdata.usgs.gov/mrds/';
const CACHE_TTL_MS=15*60*1000;
const UPSTREAM_TIMEOUT_MS=18000;
const MAX_RESULTS=2000;
const cache=new Map();

const METALS=Object.freeze({
  gold:Object.freeze({label:'Oro',codes:['AU']}),
  silver:Object.freeze({label:'Plata',codes:['AG']}),
  platinum:Object.freeze({label:'Platino',codes:['PT']}),
  palladium:Object.freeze({label:'Paladio',codes:['PD']}),
  rhodium:Object.freeze({label:'Rodio',codes:['RH']}),
  iridium:Object.freeze({label:'Iridio',codes:['IR']}),
  ruthenium:Object.freeze({label:'Rutenio',codes:['RU']}),
  osmium:Object.freeze({label:'Osmio',codes:['OS']}),
  pgm:Object.freeze({label:'PGE',codes:['PT','PD','RH','IR','RU','OS']}),
});

function clean(value){return String(value??'').trim();}
function finite(value){const n=Number(value);return Number.isFinite(n)?n:null;}
function clamp(v,min=0,max=1){return Math.max(min,Math.min(max,v));}
function escapeSql(value){return clean(value).replace(/'/g,"''");}
function validatePoint(lat,lon){
  const latitude=finite(lat),longitude=finite(lon);
  if(latitude===null||longitude===null||latitude<-90||latitude>90||longitude<-180||longitude>180)throw new Error('Coordenadas inválidas');
  return {lat:latitude,lon:longitude};
}
function normalizeBbox(input){
  let west=finite(input?.west),south=finite(input?.south),east=finite(input?.east),north=finite(input?.north);
  if([west,south,east,north].some((v)=>v===null))throw new Error('Se requieren west,south,east,north');
  west=Math.max(-180,west);east=Math.min(180,east);south=Math.max(-90,south);north=Math.min(90,north);
  if(west>=east||south>=north)throw new Error('Bounding box inválido');
  if(east-west>90||north-south>70)throw new Error('Acerca el mapa: el screening regional admite hasta 90° de ancho y 70° de alto');
  return {west,south,east,north};
}
function cacheGet(key){const hit=cache.get(key);if(!hit||Date.now()-hit.at>CACHE_TTL_MS){cache.delete(key);return null;}return hit.value;}
function cacheSet(key,value){cache.set(key,{at:Date.now(),value});return value;}

async function requestJson(url,params){
  const query=new URLSearchParams();
  for(const [key,value] of Object.entries(params||{}))if(value!==undefined&&value!==null)query.set(key,typeof value==='string'?value:JSON.stringify(value));
  query.set('f','json');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),UPSTREAM_TIMEOUT_MS);
  try{
    const response=await fetch(url+'?'+query.toString(),{headers:{Accept:'application/json','User-Agent':'GodsEyeMining/GlobalPreciousMetals'},signal:controller.signal});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error('HTTP '+response.status);
    if(payload?.error)throw new Error(payload.error.message||payload.error.details?.join('; ')||'Upstream error');
    return payload;
  }catch(error){
    if(error?.name==='AbortError')throw new Error('Fuente externa agotó el tiempo de espera');
    throw error;
  }finally{clearTimeout(timer);}
}

function bboxGeometry(bbox){return JSON.stringify({xmin:bbox.west,ymin:bbox.south,xmax:bbox.east,ymax:bbox.north,spatialReference:{wkid:4326}});}
function commodityWhere(commodity){
  const def=METALS[commodity]||METALS.gold;
  return '('+def.codes.map((code)=>`code_list LIKE '%${escapeSql(code)}%'`).join(' OR ')+')';
}
function geometryPoint(feature){
  const g=feature?.geometry;
  const gx=finite(g?.x),gy=finite(g?.y);
  if(gx!==null&&gy!==null)return {lon:gx,lat:gy};
  const a=feature?.attributes||{};
  const lon=finite(a.longitude??a.LONGITUDE),lat=finite(a.latitude??a.LATITUDE);
  return lon!==null&&lat!==null?{lon,lat}:null;
}
function attr(attributes,...keys){
  for(const key of keys){if(attributes?.[key]!==undefined&&attributes?.[key]!==null&&clean(attributes[key]))return attributes[key];}
  return null;
}
function findDepth(attributes,side){
  const patterns=side==='top'?[/depth.*top/i,/top.*depth/i,/z.*top/i]:[/depth.*bottom/i,/bottom.*depth/i,/depth.*to.*bottom/i,/z.*bottom/i];
  for(const [key,value] of Object.entries(attributes||{})){
    if(patterns.some((pattern)=>pattern.test(key))){
      const n=finite(String(value).replace(',','.').match(/-?\d+(?:\.\d+)?/)?.[0]);
      if(n!==null&&n>=0)return n;
    }
  }
  return null;
}
function normalizedMrds(feature,commodityHint='gold'){
  const a=feature?.attributes||{},point=geometryPoint(feature);if(!point)return null;
  const depId=clean(attr(a,'dep_id','DEP_ID','depid','DEPID'));
  const sourceUrl=clean(attr(a,'url','URL'))|| (depId?MRDS_PAGE+'show-mrds.php?dep_id='+encodeURIComponent(depId):MRDS_PAGE);
  const top=findDepth(a,'top'),bottom=findDepth(a,'bottom'),explicit=finite(attr(a,'depth_m','DEPTH_M','depth','DEPTH'));
  const depthM=explicit!==null?explicit:(bottom!==null?bottom:(top!==null?top:null));
  return {
    id:'USGS-MRDS-'+(depId||feature?.attributes?.objectid_1||feature?.attributes?.gid||Math.round(point.lat*1e5)+'-'+Math.round(point.lon*1e5)),
    name:clean(attr(a,'site_name','SITE_NAME'))||'USGS MRDS occurrence',
    latitude:point.lat,longitude:point.lon,
    commodity:commodityHint,
    commodities:clean(attr(a,'code_list','CODE_LIST')).split(/[,;|\s]+/).filter(Boolean),
    country:'',region:'',
    developmentStatus:clean(attr(a,'dev_stat','DEV_STAT')),
    depositType:clean(attr(a,'dep_type','DEP_TYPE','model_name','MODEL_NAME','model','MODEL')),
    grade:clean(attr(a,'grade','GRADE')),
    hostRock:clean(attr(a,'host_rock','HOST_ROCK')),
    source:'USGS MRDS',sourceUrl,depthTopM:top,depthBottomM:bottom,depthM,
    depthStatus:depthM!==null?'known':'not-reported',
  };
}
function normalizedSpecial(feature,type){
  const a=feature?.attributes||{},point=geometryPoint(feature);if(!point)return null;
  if(type==='gold'){
    return {id:'USGS-SHG-'+clean(attr(a,'recno','RECNO', 'fid','FID')),name:clean(attr(a,'depname','DEPNAME'))||'Sediment-hosted gold',latitude:point.lat,longitude:point.lon,commodity:'gold',commodities:['AU'],country:clean(attr(a,'country','COUNTRY')),region:clean(attr(a,'stprov','STPROV')),developmentStatus:'deposit',depositType:clean(attr(a,'subtype','SUBTYPE')),grade:'',hostRock:'sediment-hosted',source:'USGS Sediment-hosted Gold',sourceUrl:clean(attr(a,'url','URL'))||'https://energy.usgs.gov/arcgis/rest/services/Hosted/Sediment_hosted_gold_deposits/FeatureServer/0',depthTopM:null,depthBottomM:null,depthM:null,depthStatus:'not-reported'};
  }
  return {id:'USGS-PGE-'+clean(attr(a,'site_id','SITE_ID', 'fid','FID')),name:clean(attr(a,'name','NAME'))||'PGE-Ni-Cr occurrence',latitude:point.lat,longitude:point.lon,commodity:'pgm',commodities:clean(attr(a,'commod_gp','COMMOD_GP')).split(/[,;|\s]+/).filter(Boolean),country:clean(attr(a,'country','COUNTRY')),region:clean(attr(a,'state','STATE')),developmentStatus:clean(attr(a,'class','CLASS')),depositType:clean(attr(a,'record_tp','RECORD_TP')),grade:'',hostRock:'',source:'USGS PGE-Ni-Cr',sourceUrl:clean(attr(a,'url','URL'))||PGE_URL,depthTopM:null,depthBottomM:null,depthM:null,depthStatus:'not-reported'};
}
function dedupe(rows){
  const seen=new Set(),out=[];
  for(const row of rows){const key=[row.commodity,Math.round(row.latitude*1e4),Math.round(row.longitude*1e4),clean(row.name).toLowerCase()].join('|');if(seen.has(key))continue;seen.add(key);out.push(row);}
  return out;
}
async function queryLayer(url,bbox,where,transform,limit){
  const payload=await requestJson(url,{geometry:bboxGeometry(bbox),geometryType:'esriGeometryEnvelope',inSR:4326,spatialRel:'esriSpatialRelIntersects',where,outFields:'*',returnGeometry:'true',outSR:4326 ,resultRecordCount:Math.min(limit,2000)});
  return (payload.features||[]).map(transform).filter(Boolean);
}
async function occurrences(bbox,commodity,limit=1000){
  const key='occ:'+JSON.stringify(bbox)+':'+commodity+':'+limit;const hit=cacheGet(key);if(hit)return hit;
  const base=await queryLayer(MRDS_URL,bbox,commodityWhere(commodity),(feature)=>normalizedMrds(feature,commodity==='gold'||commodity==='silver'||commodity==='platinum'||commodity==='palladium'||commodity==='rhodium'||commodity==='iridium'||commodity==='ruthenium'||commodity==='osmium'?commodity:'pgm'),Math.min(limit,2000));
  const extras=[];
  if(commodity==='gold')extras.push(...await queryLayer(SEDIMENT_GOLD_URL,bbox,'1=1',(f)=>normalizedSpecial(f,'gold'),Math.min(500,limit)));
  if(commodity==='pgm'||['platinum','palladium','rhodium','iridium','ruthenium','osmium'].includes(commodity))extras.push(...await queryLayer(PGE_URL,bbox,'1=1',(f)=>normalizedSpecial(f,'pgm'),Math.min(500,limit)));
  return cacheSet(key,dedupe([...base,...extras]).slice(0,limit));
}
function haversineKm(a,b){
  const R=6371,rad=Math.PI/180,dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad;
  const s=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}
function flattenMacrostrat(payload){
  try{return JSON.stringify(payload?.success?.data??payload?.data??payload??'').slice(0,12000);}catch{return '';}
}
function geologyScore(text,commodity){
  const t=String(text||'').toLowerCase();
  const patterns=commodity==='gold'
    ? ['greenstone','schist','quartzite','metavolcan','granite','granodiorite','rhyolite','andesite','diorite','carbonate','alluv','volcan']
    : commodity==='silver'
      ? ['rhyolite','andesite','dacite','volcan','carbonate','granite','diorite','vein']
      : ['ultramaf','peridot','dunite','pyroxen','gabbro','mafic','layered','chromite'];
  return clamp(patterns.reduce((sum,p)=>sum+(t.includes(p)?1:0),0)/Math.max(1,patterns.length/2));
}
async function macrostrat(lat,lon){
  const response=await fetch(MACROSTRAT_URL+'?lat='+encodeURIComponent(lat)+'&lng='+encodeURIComponent(lon)+'&response=long',{headers:{Accept:'application/json','User-Agent':'GodsEyeMining/GlobalPreciousMetals'},signal:AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error('Macrostrat HTTP '+response.status);
  return {raw:payload,text:flattenMacrostrat(payload)};
}
async function emag2(lat,lon){
  const geometry=JSON.stringify({x:lon,y:lat,spatialReference:{wkid:4326}});
  const payload=await requestJson(EMAG2_SAMPLES_URL,{geometry,geometryType:'esriGeometryPoint',returnFirstValueOnly:true,interpolation:'RSP_BilinearInterpolation'});
  const sample=Array.isArray(payload?.samples)?payload.samples[0]:payload?.value??null;
  const value=finite(sample?.value??sample?.attributes?.value??sample?.attributes?.VALUE??sample?.attributes?.['Pixel Value']??sample);
  return {valueNtf:value,raw:sample??null,source:EMAG2_SAMPLES_URL};
}
async function analyzePoint(lat,lon,commodity){
  const point=validatePoint(lat,lon),safeCommodity=METALS[commodity]?commodity:'gold',delta=.5;
  const bbox={west:Math.max(-180,point.lon-delta),south:Math.max(-90,point.lat-delta),east:Math.min(180,point.lon+delta),north:Math.min(90,point.lat+delta)};
  const [rows,geo,mag]=await Promise.all([
    occurrences(bbox,safeCommodity,250),
    macrostrat(point.lat,point.lon).catch((error)=>({raw:null,text:'',error:String(error?.message||error)})),
    emag2(point.lat,point.lon).catch((error)=>({valueNtf:null,raw:null,source:EMAG2_SAMPLES_URL,error:String(error?.message||error)})),
  ]);
  const nearest=rows.map((row)=>({...row,distanceKm:haversineKm(point,{lat:row.latitude,lon:row.longitude})})).sort((a,b)=>a.distanceKm-b.distanceKm)[0]||null;
  const nearby=rows.filter((row)=>haversineKm(point,{lat:row.latitude,lon:row.longitude})<=100).length;
  const occurrenceProximity=nearest?Math.exp(-nearest.distanceKm/75):0;
  const occurrenceDensity=clamp(nearby/12);
  const gScore=geologyScore(geo.text,safeCommodity);
  const mScore=mag.valueNtf===null?0:clamp(Math.abs(mag.valueNtf)/800);
  const depositText=nearest?.depositType||'';
  const depthEstimate = safeCommodity==='gold'
    ? (/alluv|placer|gravel|sand/i.test(geo.text+depositText)?{topM:0,bottomM:50,confidence:'low',system:'placer'}:/greenstone|schist|quartzite|orogenic/i.test(geo.text+depositText)?{topM:100,bottomM:2000,confidence:'low',system:'orogenic'}:{topM:100,bottomM:1500,confidence:'low',system:'gold-mineral-system'})
    : safeCommodity==='silver'?{topM:50,bottomM:1200,confidence:'low',system:'silver-hydrothermal'}
    :{topM:100,bottomM:2500,confidence:'low',system:'PGE-magmatic'};
  const score=clamp(.32*occurrenceProximity+.12*occurrenceDensity+.28*gScore+.16*mScore+.12*(nearest?.depositType?0.6:0.3));
  return {
    point,commodity:safeCommodity,score,confidence:'screening-high-uncertainty',uncertainty:'high',
    nearestOccurrence:nearest,nearbyOccurrenceCount100Km:nearby,
    evidence:{occurrenceProximity,occurrenceDensity,geologyScore:gScore,magneticScore:mScore,macrostrat:geo.raw,emag2:mag.valueNtf},
    depth:{estimated:depthEstimate,nearestKnownM:nearest?.depthM??null,nearestDepthStatus:nearest?.depthStatus||'not-reported'},
    generatedAt:new Date().toISOString(),
    sources:{mrds:MRDS_URL,sedimentGold:SEDIMENT_GOLD_URL,pge:PGE_URL,macrostrat:MACROSTRAT_URL,emag2:EMAG2_SAMPLES_URL},
    caveat:'Screening predictivo. Una coordenada sin dato de perforación/geofísica de campaña no demuestra mineralización, ley, tonelaje ni profundidad exacta. Las profundidades estimadas son horizontes conceptuales de baja confianza.',
  };
}
function sourceCatalog(){
  return [
    {id:'mrds',name:'USGS Mineral Resource Data System',role:'Global documented mineral occurrences/deposits',url:MRDS_URL,coverage:'Global; incomplete outside the United States.'},
    {id:'sediment-gold',name:'USGS Sediment-hosted Gold Deposits',role:'Specialized gold deposit model',url:SEDIMENT_GOLD_URL,coverage:'Global dataset extent; not exhaustive.'},
    {id:'pge',name:'USGS PGE-Ni-Cr deposits and occurrences',role:'Platinum-group-element occurrence context',url:PGE_URL,coverage:'Global.'},
    {id:'macrostrat',name:'Macrostrat',role:'Geologic-unit context at point',url:MACROSTRAT_URL,coverage:'Integrated global geologic data; regional detail varies.'},
    {id:'emag2',name:'NOAA EMAG2 v3',role:'Global magnetic-anomaly context',url:EMAG2_SAMPLES_URL,coverage:'Global gridded magnetic anomaly model.'},
  ];
}
export function globalPreciousMetalsProxy(){
  const install=(server)=>{
    server.middlewares.use('/api/global-precious-metals',async(req,res)=>{
      const reply=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
      try{
        if(req.method!=='GET')return reply(405,{error:'GET required'});
        const url=new URL(req.url||'http://localhost','http://localhost');
        if(url.pathname==='/sources')return reply(200,{sources:sourceCatalog(),generatedAt:new Date().toISOString()});
        if(url.pathname==='/occurrences'){
          const bbox=normalizeBbox(Object.fromEntries(['west','south','east','north'].map((key)=>[key,url.searchParams.get(key)])));
          const commodity=METALS[url.searchParams.get('commodity')]?url.searchParams.get('commodity'):'gold';
          const limit=Math.min(MAX_RESULTS,Math.max(1,Number.parseInt(url.searchParams.get('limit')||'1000',10)||1000));
          return reply(200,{commodity,bbox,count:(await occurrences(bbox,commodity,limit)).length,occurrences:await occurrences(bbox,commodity,limit),generatedAt:new Date().toISOString(),partial:limit>=MAX_RESULTS,caveat:'USGS MRDS is a documented occurrence dataset, not a complete map of undiscovered resources.'});
        }
        if(url.pathname==='/analyze'){
          const result=await analyzePoint(url.searchParams.get('lat'),url.searchParams.get('lon'),clean(url.searchParams.get('commodity'))||'gold');
          return reply(200,result);
        }
        return reply(404,{error:'Not found'});
      }catch(error){
        console.error('[Global Precious Metals]',error?.message||String(error));
        return reply(502,{error:'Global precious-metals query failed',detail:String(error?.message||error).slice(0,600)});
      }
    });
  };
  return {name:'global-precious-metals',configureServer:install,configurePreviewServer:install};
}
