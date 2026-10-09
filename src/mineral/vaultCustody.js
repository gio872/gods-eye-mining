/**
 * GEM Vault & Custody Network.
 * Provider-neutral inventory/custody ledger for high-value physical assets.
 * It records custody evidence; it does not itself provide custody.
 */
export const GEM_VAULT_CUSTODY_VERSION='1.0.0';

export const STORAGE_FACILITY_TYPES=Object.freeze([
 'VAULT','BONDED_WAREHOUSE','FREE_TRADE_ZONE','CUSTOMS_DEPOT','SECURE_STORAGE'
]);
export const ASSET_FORMS=Object.freeze([
 'BAR','INGOT','DORÉ','CONCENTRATE','COIN','GEMSTONE','DIAMOND','JEWELLERY','CASH','LOT'
]);
export const CUSTODY_STATUSES=Object.freeze([
 'EXPECTED','RECEIVED','INSPECTED','ASSAY_PENDING','ASSAY_VERIFIED',
 'ALLOCATED','RELEASE_REQUESTED','RELEASED','TRANSFERRED','DISPUTED','HOLD'
]);

const clean=v=>String(v??'').trim();
const upper=v=>clean(v).toUpperCase();

export function createVaultFacility(input={}){
 if(!input.id||!input.name||!input.country)throw new TypeError('id, name and country are required');
 const type=upper(input.type||'VAULT');
 if(!STORAGE_FACILITY_TYPES.includes(type))throw new RangeError('Unsupported facility type');
 return Object.freeze({
  version:GEM_VAULT_CUSTODY_VERSION,id:clean(input.id),name:clean(input.name),type,
  country:input.country,city:input.city||null,address:input.address||null,
  operator:input.operator||null,commodities:Array.isArray(input.commodities)?input.commodities.map(upper):[],
  services:Array.isArray(input.services)?[...input.services]:[],
  insuranceProvider:input.insuranceProvider||null,insuranceLimit:input.insuranceLimit??null,
  customsStatus:input.customsStatus||null,ftzStatus:input.ftzStatus||null,
  apiReady:input.apiReady===true,verificationStatus:input.verificationStatus||'PUBLIC_SOURCE_RECORDED',
  sourceId:input.sourceId||null,sourceUrl:input.sourceUrl||null,
  provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

export function createCustodyLot(input={}){
 const weight=Number(input.weight);
 if(!input.id||!input.facilityId||!input.assetType||!input.commodity||!Number.isFinite(weight)||weight<=0)
  throw new TypeError('id, facilityId, assetType, commodity and positive weight are required');
 const assetType=upper(input.assetType);
 if(!ASSET_FORMS.includes(assetType))throw new RangeError('Unsupported asset form');
 return Object.freeze({
  version:GEM_VAULT_CUSTODY_VERSION,id:clean(input.id),tradeId:input.tradeId||null,
  facilityId:clean(input.facilityId),ownerId:input.ownerId||null,assetType,
  commodity:upper(input.commodity),serialNumber:input.serialNumber||null,
  refineryLotId:input.refineryLotId||null,sourceMineId:input.sourceMineId||null,
  weight,fineWeight:input.fineWeight??null,weightUnit:input.weightUnit||'kg',
  purity:input.purity??null,purityUnit:input.purityUnit||'%',
  declaredValue:input.declaredValue??null,currency:upper(input.currency||'USD'),
  status:'EXPECTED',allocatedTo:input.allocatedTo||null,
  sealReference:input.sealReference||null,assayId:input.assayId||null,
  provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

export function recordCustodyEvent(lot={},event={}){
 if(!lot?.id||!event.id||!event.type)throw new TypeError('lot and event id/type are required');
 return Object.freeze({...lot,custodyEvents:[...(lot.custodyEvents||[]),{
  id:clean(event.id),type:upper(event.type),timestamp:event.timestamp||new Date().toISOString(),
  actorId:event.actorId||null,facilityId:event.facilityId||lot.facilityId,
  weight:event.weight??null,sealReference:event.sealReference||null,
  evidenceHash:event.evidenceHash||null,sourceId:event.sourceId||null
 }]});
}

export function attachAssay(lot={},assay={}){
 if(!lot?.id||!assay.id||assay.result==null)throw new TypeError('lot, assay id and assay result are required');
 return Object.freeze({...lot,assayId:clean(assay.id),assay:{
  result:assay.result,unit:assay.unit||null,laboratory:assay.laboratory||null,
  method:assay.method||null,sampleId:assay.sampleId||null,
  verified:assay.verified===true,sourceId:assay.sourceId||null,
  certificateHash:assay.certificateHash||null
 },status:assay.verified===true?'ASSAY_VERIFIED':'ASSAY_PENDING'});
}

export function allocateCustodyLot(lot={},ownerId,allocationId){
 if(!lot?.id||!ownerId||!allocationId)throw new TypeError('lot, ownerId and allocationId are required');
 if(!['ASSAY_VERIFIED','ALLOCATED','RELEASE_REQUESTED'].includes(lot.status))
  throw new RangeError('Lot must have verified assay before allocation');
 return Object.freeze({...lot,ownerId,allocatedTo:clean(allocationId),status:'ALLOCATED'});
}

export function requestRelease(lot={},release={}){
 if(!lot?.id||!release.id)throw new TypeError('lot and release id are required');
 if(!['ALLOCATED','ASSAY_VERIFIED'].includes(lot.status))throw new RangeError('Lot is not release-ready');
 return Object.freeze({...lot,status:'RELEASE_REQUESTED',releaseRequest:{
  id:clean(release.id),destination:release.destination||null,beneficiaryId:release.beneficiaryId||null,
  settlementReference:release.settlementReference||null,requestedAt:new Date().toISOString()
 }});
}

export function buildCustodySnapshot({facilities=[],lots=[],events=[]}={}){
 return Object.freeze({
  version:GEM_VAULT_CUSTODY_VERSION,facilityCount:facilities.length,
  lotCount:lots.length,totalWeight:lots.reduce((s,l)=>s+Number(l.weight||0),0),
  assayVerified:lots.filter(l=>l.status==='ASSAY_VERIFIED'||l.status==='ALLOCATED'||l.status==='RELEASE_REQUESTED').length,
  allocated:lots.filter(l=>l.status==='ALLOCATED').length,
  releaseRequested:lots.filter(l=>l.status==='RELEASE_REQUESTED').length,
  disputed:lots.filter(l=>l.status==='DISPUTED').length,
  eventCount:events.length
 });
}
