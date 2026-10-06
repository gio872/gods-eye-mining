const PLANETARY_STAC='https://planetarycomputer.microsoft.com/api/stac/v1/search';
const PLANETARY_SIGN='https://planetarycomputer.microsoft.com/api/sas/v1/sign';
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
function cacheGet(key){const hit=cache.get(key);if(!hit||Date.now()-hit.at>10*60*1000){cache.delete(key);return null;}return hit.value;}
function cacheSet(key,value){cache.set(key,{at:Date.now(),value});return value;}

async function jsonFetch(url,options={}){
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error('HTTP '+response.status);
  return payload;
}
async function signedHref(href){
  if(!href)return null;
  try{
    const payload=await jsonFetch(PLANETARY_SIGN+'?href='+encodeURIComponent(href));
    return clean(payload?.href||payload?.signed_href)||href;
  }catch{return href;}
}
function assetHref(item,key){return clean(item?.assets?.[key]?.href)||null;}
async function normalizeItem(item){
  const keys=['rendered_preview','visual','red','green','blue','nir08','swir16','swir22'];
  const signed={};
  for(const key of keys){const href=assetHref(item,key);if(href)signed[key]=await signedHref(href);}
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
  const payload=await jsonFetch(PLANETARY_STAC,{method:'POST',headers:{Accept:'application/geo+json','Content-Type':'application/json'},body:JSON.stringify(body)});
  const items=await Promise.all((payload?.features||[]).map(normalizeItem));
  return cacheSet(key,{collection:safeCollection,count:items.length,items,generatedAt:new Date().toISOString(),source:PLANETARY_STAC});
}
function sourceCatalog(){
  return [
    {id:'mine-the-gap',name:'MINE-THE-GAP Global Commodity-specific Mining Land Use',type:'satellite-derived mining intelligence',url:MINETHGAP_MAP,cog:MINETHGAP_COG,coverage:'Global',license:'CC BY-NC-SA 4.0',role:'Commodity-linked global mining land-use raster.'},
    {id:'global-mining-footprint',name:'Global Mining Footprint Tang & Werner',type:'satellite-derived mining footprint',url:GLOBAL_MINING_FOOTPRINT,coverage:'135 countries/regions',role:'74,548 satellite-interpreted mining polygons.'},
    {id:'global-mining-80k',name:'Global Mining Land Use Classification',type:'Sentinel-2 + TanDEM-X + Random Forest',url:GLOBAL_MINING_80K,coverage:'150 countries',role:'>80,000 recognised mining extents with land-use classes.'},
    {id:'sentinel-2',name:'Sentinel-2 L2A · Planetary Computer',type:'multispectral satellite',url:'https://planetarycomputer.microsoft.com/api/stac/v1/',coverage:'Global land',role:'10–60 m surface reflectance; live scene discovery.'},
    {id:'landsat',name:'Landsat Collection 2 L2 · Planetary Computer',type:'multispectral satellite archive',url:'https://planetarycomputer.microsoft.com/api/stac/v1/',coverage:'Global land',role:'Long temporal archive for surface change.'},
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
        return reply(404,{error:'Not found'});
      }catch(error){
        console.error('[Global Satellite Mining]',error?.message||String(error));
        return reply(502,{error:'Global satellite-mining query failed',detail:String(error?.message||error).slice(0,600)});
      }
    });
  };
  return {name:'global-satellite-mining',configureServer:install,configurePreviewServer:install};
}
