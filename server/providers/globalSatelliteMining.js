import { calculateSentinel2MineralFeatures } from '../../src/mining/core/spectralFeatures.js';

const STAC_BASE='https://planetarycomputer.microsoft.com/api/stac/v1';
const STAC_SEARCH=STAC_BASE+'/search';
const SIGN_URL='https://planetarycomputer.microsoft.com/api/sas/v1/sign';
const DATA_API='https://planetarycomputer.microsoft.com/api/data/v1';
const MINETHGAP_COG='https://maps.minethegap.eu/assets/data/material_areas_km2-20251227.tif';
const MINETHGAP_MAP='https://maps.minethegap.eu/';
const GLOBAL_MINING_FOOTPRINT='https://doi.org/10.5281/zenodo.7894216';
const GLOBAL_MINING_80K='https://doi.org/10.5281/zenodo.15726306';
const REQUEST_TIMEOUT_MS=20000;
const cache=new Map();

function finite(v){const n=Number(v);return Number.isFinite(n)?n:null;}
function clean(v){return String(v??'').trim();}
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function bbox(input){
  const west=finite(input?.west),south=finite(input?.south),east=finite(input?.east),north=finite(input?.north);
  if([west,south,east,north].some((v)=>v===null)||west>=east||south>=north)throw new Error('Bounding box inválido');
  if(east-west>20||north-south>20)throw new Error('Acerca el mapa: la búsqueda satelital admite hasta 20° × 20°');
  return {west,south,east,north};
}
function validatePoint(lat,lon){
  const latitude=finite(lat),longitude=finite(lon);
  if(latitude===null||longitude===null||latitude<-90||latitude>90||longitude<-180||longitude>180)throw new Error('Coordenadas inválidas');
  return {lat:latitude,lon:longitude};
}
function cacheGet(key){const hit=cache.get(key);if(!hit||Date.now()-hit.at>10*60*1000){cache.delete(key);return null;}return hit.value;}
function cacheSet(key,value){cache.set(key,{at:Date.now(),value});return value;}

async function jsonFetch(url,options={}){
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error('HTTP '+response.status);
  if(payload?.error)throw new Error(payload.error.message||payload.error.details?.join('; ')||'Upstream error');
  return payload;
}
async function signedHref(href){
  if(!href)return null;
  const payload=await jsonFetch(SIGN_URL+'?href='+encodeURIComponent(href));
  return clean(payload?.href)||href;
}
function assetFor(item,keys=[]){
  for(const key of keys){
    const asset=item?.assets?.[key];
    if(asset?.href)return {key,asset};
  }
  return null;
}
async function normalizeItem(item){
  const keys=['rendered_preview','visual','red','green','blue','nir08','swir16','swir22'];
  const signed={};
  for(const key of keys){const href=item?.assets?.[key]?.href;if(href)signed[key]=await signedHref(href);}
  return {
    id:item?.id||null,
    collection:Array.isArray(item?.collection)?item.collection[0]:(item?.collection||null),
    datetime:item?.properties?.datetime||item?.properties?.start_datetime||null,
    platform:item?.properties?.platform||null,
    constellation:item?.properties?.constellation||null,
    cloudCover:finite(item?.properties?.['eo:cloud_cover']),
    geometry:item?.geometry||null,
    bbox:item?.bbox||null,
    tile:item?.properties?.['s2:mgrs_tile']||null,
    assets:signed,
    roles:Object.fromEntries(Object.entries(item?.assets||{}).map(([key,a])=>[key,a?.title||a?.roles||null])),
  };
}
async function searchScenes({bboxValue,collection='sentinel-2-l2a',startDate='2025-01-01',endDate=new Date().toISOString().slice(0,10),maxCloud=20,limit=12}){
  const safeBbox=bbox(bboxValue);
  const safeLimit=clamp(Number.parseInt(limit,10)||12,1,25);
  const safeCloud=clamp(Number(maxCloud)||20,0,100);
  const safeCollection=['sentinel-2-l2a','landsat-c2-l2'].includes(collection)?collection:'sentinel-2-l2a';
  const key=JSON.stringify({safeBbox,safeCollection,startDate,endDate,safeCloud,safeLimit});
  const hit=cacheGet(key);if(hit)return hit;
  const body={
    collections:[safeCollection],
    bbox:[safeBbox.west,safeBbox.south,safeBbox.east,safeBbox.north],
    datetime:String(startDate)+'T00:00:00Z/'+String(endDate)+'T23:59:59Z',
    limit:safeLimit,
    query:{'eo:cloud_cover':{lte:safeCloud}},
    sortby:[{field:'properties.datetime',direction:'desc'}],
  };
  const payload=await jsonFetch(STAC_SEARCH,{method:'POST',headers:{Accept:'application/geo+json','Content-Type':'application/json'},body:JSON.stringify(body)});
  const items=await Promise.all((payload?.features||[]).map(normalizeItem));
  return cacheSet(key,{collection:safeCollection,count:items.length,items,generatedAt:new Date().toISOString(),source:STAC_SEARCH});
}

const SENTINEL2_BAND_KEYS=Object.freeze({
  B2:['B02','blue'],
  B3:['B03','green'],
  B4:['B04','red'],
  B6:['B06'],
  B8:['B08','nir08'],
  B11:['B11','swir16'],
  B12:['B12','swir22'],
});

function scaledReflectance(value,asset){
  const n=finite(value);if(n===null)return null;
  const bandInfo=Array.isArray(asset?.['raster:bands'])?asset['raster:bands'][0]:null;
  const scale=finite(bandInfo?.scale),offset=finite(bandInfo?.offset);
  if(scale!==null)return n*scale+(offset??0);
  return Math.abs(n)>2?n/10000:n;
}
async function sampleCogPoint({href,lat,lon}){
  const url=DATA_API+'/cog/point/'+encodeURIComponent(lon)+','+encodeURIComponent(lat)+'?url='+encodeURIComponent(href)+'&bidx=1&resampling=nearest';
  const payload=await jsonFetch(url,{headers:{Accept:'application/json'}});
  const raw=Array.isArray(payload?.values)?payload.values[0]:payload?.value??null;
  return {raw,bandNames:payload?.band_names||null};
}
async function sampleSentinel2({sceneId,latitude,longitude}){
  const point=validatePoint(latitude,longitude);
  const safeSceneId=clean(sceneId);if(!safeSceneId)throw new Error('sceneId es requerido');
  const key='s2sample:'+safeSceneId+':'+point.lat.toFixed(6)+':'+point.lon.toFixed(6);
  const hit=cacheGet(key);if(hit)return hit;
  const item=await jsonFetch(STAC_BASE+'/collections/sentinel-2-l2a/items/'+encodeURIComponent(safeSceneId));
  const bands={};const rawBands={};const errors=[];
  await Promise.all(Object.entries(SENTINEL2_BAND_KEYS).map(async([band,keys])=>{
    try{
      const found=assetFor(item,keys);
      if(!found)throw new Error('Asset '+band+' no disponible');
      const href=await signedHref(found.asset.href);
      const result=await sampleCogPoint({href,lat:point.lat,lon:point.lon});
      rawBands[band]=result.raw;
      bands[band]=scaledReflectance(result.raw,found.asset);
    }catch(error){errors.push({band,error:String(error?.message||error)});}
  }));
  const features=calculateSentinel2MineralFeatures(bands);
  const result={
    sensor:'Sentinel-2 MSI L2A',
    scene:{id:item?.id||safeSceneId,datetime:item?.properties?.datetime||null,cloudCover:finite(item?.properties?.['eo:cloud_cover']),tile:item?.properties?.['s2:mgrs_tile']||null},
    point,
    bands:Object.freeze(bands),
    rawBands:Object.freeze(rawBands),
    rawAvailable:Object.keys(bands).length,
    features,
    errors,
    partial:errors.length>0,
    generatedAt:new Date().toISOString(),
    source:{stac:STAC_BASE,dataApi:DATA_API,collection:'sentinel-2-l2a'},
  };
  return cacheSet(key,result);
}
function sourceCatalog(){
  return [
    {id:'mine-the-gap',name:'MINE-THE-GAP Global Commodity-specific Mining Land Use',type:'satellite-derived mining intelligence',url:MINETHGAP_MAP,cog:MINETHGAP_COG,coverage:'Global',license:'CC BY-NC-SA 4.0',role:'Commodity-linked global mining-land-use raster.'},
    {id:'global-mining-footprint',name:'Global Mining Footprint Tang & Werner',type:'satellite-derived mining footprint',url:GLOBAL_MINING_FOOTPRINT,coverage:'135 countries/regions',role:'74,548 satellite-interpreted mining polygons.'},
    {id:'global-mining-80k',name:'Global Mining Land Use Classification',type:'Sentinel-2 + TanDEM-X + Random Forest',url:GLOBAL_MINING_80K,coverage:'150 countries',role:'>80,000 recognised mining extents with land-use classes.'},
    {id:'sentinel-2',name:'Sentinel-2 L2A · Planetary Computer',type:'multispectral satellite',url:STAC_BASE,coverage:'Global land',role:'13-band bottom-of-atmosphere surface reflectance; pixel sampling enabled in GEM.'},
    {id:'landsat',name:'Landsat Collection 2 L2 · Planetary Computer',type:'multispectral satellite archive',url:STAC_BASE,coverage:'Global land',role:'Long temporal archive for surface change.'},
    {id:'emit-l2b',name:'NASA EMIT L2BMIN',type:'imaging spectroscopy / mineral identification',url:'https://search.earthdata.nasa.gov/search?fpj=GEMx%21EMIT',coverage:'Arid regions, approximately 52°N to 52°S',role:'Mineral identification + band depth + uncertainty + fit score.'},
    {id:'enmap',name:'DLR EnMAP',type:'hyperspectral satellite',url:'https://www.enmap.org/data_access/',coverage:'Global tasking/archive; access controlled by DLR portal',role:'420–2450 nm hyperspectral mineral/alteration feature extraction.'},
  ];
}
export function globalSatelliteMiningProxy(){
  const install=(server)=>{
    server.middlewares.use('/api/global-satellite-mining',async(req,res)=>{
      const reply=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
      try{
        if(req.method!=='GET')return reply(405,{error:'GET required'});
        const url=new URL(req.url||'http://localhost','http://localhost');
        if(url.pathname==='/sources')return reply(200,{sources:sourceCatalog(),generatedAt:new Date().toISOString()});
        if(url.pathname==='/scenes'){
          const result=await searchScenes({
            bboxValue:{west:url.searchParams.get('west'),south:url.searchParams.get('south'),east:url.searchParams.get('east'),north:url.searchParams.get('north')},
            collection:clean(url.searchParams.get('collection'))||'sentinel-2-l2a',
            startDate:clean(url.searchParams.get('start'))||'2025-01-01',
            endDate:clean(url.searchParams.get('end'))||new Date().toISOString().slice(0,10),
            maxCloud:url.searchParams.get('maxCloud')??20,
            limit:url.searchParams.get('limit')??12,
          });
          return reply(200,result);
        }
        if(url.pathname==='/sample-sentinel2'){
          return reply(200,await sampleSentinel2({sceneId:url.searchParams.get('sceneId'),latitude:url.searchParams.get('lat'),longitude:url.searchParams.get('lon')}));
        }
        return reply(404,{error:'Not found'});
      }catch(error){
        console.error('[Global Satellite Mining]',error?.message||String(error));
        return reply(502,{error:'Global satellite-mining query failed',detail:String(error?.message||error).slice(0,600)});
      }
    });
  };
  return {name:'global-satellite-mining',configureServer:install,configurePreviewServer:install};
}
