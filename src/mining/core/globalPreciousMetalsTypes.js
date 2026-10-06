export const GLOBAL_PRECIOUS_METALS = Object.freeze([
  Object.freeze({ id:'gold', label:'Oro', codes:Object.freeze(['AU']), symbols:Object.freeze(['Au']) }),
  Object.freeze({ id:'silver', label:'Plata', codes:Object.freeze(['AG']), symbols:Object.freeze(['Ag']) }),
  Object.freeze({ id:'platinum', label:'Platino', codes:Object.freeze(['PT']), symbols:Object.freeze(['Pt']) }),
  Object.freeze({ id:'palladium', label:'Paladio', codes:Object.freeze(['PD']), symbols:Object.freeze(['Pd']) }),
  Object.freeze({ id:'rhodium', label:'Rodio', codes:Object.freeze(['RH']), symbols:Object.freeze(['Rh']) }),
  Object.freeze({ id:'iridium', label:'Iridio', codes:Object.freeze(['IR']), symbols:Object.freeze(['Ir']) }),
  Object.freeze({ id:'ruthenium', label:'Rutenio', codes:Object.freeze(['RU']), symbols:Object.freeze(['Ru']) }),
  Object.freeze({ id:'osmium', label:'Osmio', codes:Object.freeze(['OS']), symbols:Object.freeze(['Os']) }),
  Object.freeze({ id:'pgm', label:'PGE / Metales del grupo del platino', codes:Object.freeze(['PT','PD','RH','IR','RU','OS']), symbols:Object.freeze(['Pt','Pd','Rh','Ir','Ru','Os']) }),
]);

export const GLOBAL_PRECIOUS_METAL_IDS = Object.freeze(GLOBAL_PRECIOUS_METALS.map((item)=>item.id));

export function getPreciousMetalDefinition(id='gold'){
  return GLOBAL_PRECIOUS_METALS.find((item)=>item.id===String(id)) || GLOBAL_PRECIOUS_METALS[0];
}

export function normalizeGlobalOccurrence(input={}) {
  const latitude=Number(input.latitude),longitude=Number(input.longitude);
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude < -90||latitude > 90||longitude < -180||longitude > 180)return null;
  const depthTopM=Number(input.depthTopM),depthBottomM=Number(input.depthBottomM);
  const knownDepth=Number.isFinite(depthTopM)||Number.isFinite(depthBottomM);
  return Object.freeze({
    id:String(input.id||input.depositId||('occurrence-'+latitude.toFixed(5)+'-'+longitude.toFixed(5))),
    name:String(input.name||input.siteName||'Unnamed occurrence').trim(),
    latitude,longitude,
    commodity:String(input.commodity||'gold').trim().toLowerCase(),
    commodities:Array.isArray(input.commodities)?input.commodities.map((v)=>String(v).trim()).filter(Boolean):[],
    country:String(input.country||'').trim(),
    region:String(input.region||input.state||'').trim(),
    developmentStatus:String(input.developmentStatus||'').trim(),
    depositType:String(input.depositType||input.modelName||'').trim(),
    grade:String(input.grade||'').trim(),
    hostRock:String(input.hostRock||'').trim(),
    source:String(input.source||'USGS MRDS').trim(),
    sourceUrl:String(input.sourceUrl||'').trim(),
    depthTopM: Number.isFinite(depthTopM)?depthTopM:null,
    depthBottomM:Number.isFinite(depthBottomM)?depthBottomM:null,
    depthM: Number.isFinite(Number(input.depthM))?Number(input.depthM):(Number.isFinite(depthBottomM)?depthBottomM:(Number.isFinite(depthTopM)?depthTopM:null)),
    depthStatus:knownDepth?'known':'not-reported',
    raw:Object.freeze(input.raw&&typeof input.raw==='object'?{...input.raw}:{}),
  });
}

export function estimateTargetDepth({commodity='gold',geologyText='',depositType=''}={}) {
  const text=(String(geologyText)+' '+String(depositType)).toLowerCase();
  if(/alluv|placer|gravel|sand/.test(text))return Object.freeze({topM:0,bottomM:50,system:'placer',confidence:'low'});
  if(/epitherm|volcanic|rhyolit|andesit|dacite/.test(text))return Object.freeze({topM:50,bottomM:800,system:'epithermal/volcanic',confidence:'low'});
  if(/greenstone|schist|quartzite|metavolcan|orogenic/.test(text))return Object.freeze({topM:100,bottomM:2000,system:'orogenic',confidence:'low'});
  if(/ultramaf|peridot|dunite|pyroxen|gabbro|layered intrusion|mafic/.test(text) && String(commodity).toLowerCase()==='pgm')return Object.freeze({topM:100,bottomM:2500,system:'magmatic-PGE',confidence:'low'});
  if(String(commodity).toLowerCase()==='silver')return Object.freeze({topM:50,bottomM:1200,system:'silver-hydrothermal',confidence:'low'});
  if(String(commodity).toLowerCase()==='pgm'||['platinum','palladium','rhodium','iridium','ruthenium','osmium'].includes(String(commodity).toLowerCase()))return Object.freeze({topM:100,bottomM:2500,system:'PGE-magmatic',confidence:'low'});
  return Object.freeze({topM:100,bottomM:1500,system:'gold-mineral-system',confidence:'low'});
}
