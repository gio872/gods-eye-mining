/**
 * GEM Global Asset Registry.
 * Registry/index for physical asset digital twins.
 * Location is evidence-backed metadata; registry presence is not proof of ownership,
 * value, custody, reserve or settlement.
 */
export const GEM_GLOBAL_ASSET_REGISTRY_VERSION='1.0.0';

export const ASSET_REGISTRY_STATUSES=Object.freeze([
 'IDENTIFIED','ORIGIN_VALIDATED','ASSAY_VALIDATED','IN_TRANSIT','IN_CUSTODY',
 'ALLOCATED','TRADE_COMMITTED','FINANCED','SETTLEMENT_PENDING','RELEASED',
 'TRANSFERRED','DISPUTED','HOLD'
]);

const clean=v=>String(v??'').trim();
const upper=v=>clean(v).toUpperCase();

export function registerAssetTwin(twin={},meta={}){
 if(!twin.twinId||!twin.passportId||!twin.assetId)throw new TypeError('twinId, passportId and assetId are required');
 return Object.freeze({
  registryVersion:GEM_GLOBAL_ASSET_REGISTRY_VERSION,
  registryId:clean(meta.registryId||twin.twinId),
  twinId:twin.twinId,passportId:twin.passportId,assetId:twin.assetId,
  commodity:upper(twin.commodity),assetType:upper(twin.assetType),
  state:ASSET_REGISTRY_STATUSES.includes(upper(twin.state))?upper(twin.state):'IDENTIFIED',
  ownerId:twin.ownerId||null,facilityId:twin.facilityId||null,
  location:meta.location||twin.location||null,
  locationEvidence:meta.locationEvidence||null,
  country:meta.country||null,region:meta.region||null,
  tradeId:twin.links?.tradeId||null,settlementId:twin.links?.settlementId||null,
  shipmentId:twin.links?.shipmentId||null,
  evidenceCount:(twin.evidenceHashes||[]).length,
  eventCount:(twin.events||[]).length,
  indexedAt:meta.indexedAt||new Date().toISOString()
 });
}

export function indexAssetTwins(twins=[],options={}){
 const records=twins.map(t=>registerAssetTwin(t,options[t.twinId]||{}));
 return Object.freeze({version:GEM_GLOBAL_ASSET_REGISTRY_VERSION,records});
}

export function searchAssetRegistry(records=[],filters={}){
 const commodity=filters.commodity?upper(filters.commodity):null;
 const state=filters.state?upper(filters.state):null;
 const country=filters.country?clean(filters.country).toLowerCase():null;
 const assetType=filters.assetType?upper(filters.assetType):null;
 const tradeOnly=filters.tradeOnly===true;
 const settlementOnly=filters.settlementOnly===true;
 return records.filter(r=>
  (!commodity||r.commodity===commodity)&&(!state||r.state===state)&&
  (!assetType||r.assetType===assetType)&&(!country||String(r.country||'').toLowerCase()===country)&&
  (!tradeOnly||Boolean(r.tradeId))&&(!settlementOnly||Boolean(r.settlementId))
 );
}

export function buildAssetMapFeatures(records=[]){
 return records.filter(r=>{
  const lat=Number(r.location?.latitude),lon=Number(r.location?.longitude);
  return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180&&r.locationEvidence;
 }).map(r=>({
  type:'Feature',
  geometry:{type:'Point',coordinates:[Number(r.location.longitude),Number(r.location.latitude)]},
  properties:{
   registryId:r.registryId,assetId:r.assetId,passportId:r.passportId,
   commodity:r.commodity,assetType:r.assetType,state:r.state,country:r.country||null,
   facilityId:r.facilityId,tradeId:r.tradeId,settlementId:r.settlementId,
   evidenceCount:r.evidenceCount,eventCount:r.eventCount
  }
 }));
}

export function buildAssetRegistrySnapshot(records=[]){
 const byCommodity={};
 for(const r of records)byCommodity[r.commodity]=(byCommodity[r.commodity]||0)+1;
 return Object.freeze({
  version:GEM_GLOBAL_ASSET_REGISTRY_VERSION,totalAssets:records.length,
  locatedAssets:records.filter(r=>r.locationEvidence&&r.location).length,
  tradeLinked:records.filter(r=>r.tradeId).length,
  settlementLinked:records.filter(r=>r.settlementId).length,
  disputed:records.filter(r=>r.state==='DISPUTED').length,
  byCommodity
 });
}
