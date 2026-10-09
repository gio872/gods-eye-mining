/**
 * GEM Asset Passport.
 * Persistent identity and provenance envelope for physical high-value assets.
 * Provider-neutral: it does not assert ownership, assay, custody, payment or settlement
 * unless independently evidenced.
 */
export const GEM_ASSET_PASSPORT_VERSION='1.0.0';

export const PASSPORT_STATUSES=Object.freeze([
 'DRAFT','IDENTIFIED','VERIFIED','IN_CUSTODY','ALLOCATED','TRADE_LINKED',
 'SETTLEMENT_LINKED','RELEASED','TRANSFERRED','DISPUTED','HOLD'
]);

export const PASSPORT_EVENT_TYPES=Object.freeze([
 'CREATED','IDENTITY_VERIFIED','ORIGIN_RECORDED','ASSAY_ATTACHED','OWNERSHIP_RECORDED',
 'CUSTODY_LINKED','TRANSPORT_LINKED','INSURANCE_LINKED','TRADE_LINKED',
 'FINANCE_LINKED','PAYMENT_LINKED','SETTLEMENT_LINKED','RELEASED','TRANSFERRED',
 'DISPUTED','HOLD_PLACED','HOLD_RELEASED'
]);

const clean=v=>String(v??'').trim();
const upper=v=>clean(v).toUpperCase();

function required(input,keys){
 for(const key of keys)if(input[key]==null||clean(input[key])==='')throw new TypeError(`${key} is required`);
}

export function createAssetPassport(input={}){
 required(input,['assetId','assetType','commodity']);
 const assetType=upper(input.assetType);
 return Object.freeze({
  version:GEM_ASSET_PASSPORT_VERSION,
  passportId:clean(input.passportId||`GEM-AP-${clean(input.assetId)}`),
  assetId:clean(input.assetId),
  assetType,
  commodity:upper(input.commodity),
  status:'IDENTIFIED',
  serialNumber:input.serialNumber||null,
  refineryLotId:input.refineryLotId||null,
  sourceMineId:input.sourceMineId||null,
  originCountry:input.originCountry||null,
  originRegion:input.originRegion||null,
  weight:input.weight??null,
  fineWeight:input.fineWeight??null,
  weightUnit:input.weightUnit||'kg',
  purity:input.purity??null,
  purityUnit:input.purityUnit||'%',
  declaredValue:input.declaredValue??null,
  currency:upper(input.currency||'USD'),
  ownerId:input.ownerId||null,
  custodyLotId:input.custodyLotId||null,
  facilityId:input.facilityId||null,
  tradeId:input.tradeId||null,
  financeId:input.financeId||null,
  paymentId:input.paymentId||null,
  settlementId:input.settlementId||null,
  shipmentId:input.shipmentId||null,
  insuranceId:input.insuranceId||null,
  assayId:input.assayId||null,
  evidenceHashes:Array.isArray(input.evidenceHashes)?[...input.evidenceHashes]:[],
  provenance:Array.isArray(input.provenance)?[...input.provenance]:[],
  createdAt:input.createdAt||new Date().toISOString(),
  events:[]
 });
}

export function appendPassportEvent(passport={},event={}){
 if(!passport.passportId||!event.id||!event.type)throw new TypeError('passport, event id and type are required');
 const type=upper(event.type);
 if(!PASSPORT_EVENT_TYPES.includes(type))throw new RangeError('Unsupported passport event');
 const nextStatus=event.status?upper(event.status):passport.status;
 if(!PASSPORT_STATUSES.includes(nextStatus))throw new RangeError('Unsupported passport status');
 return Object.freeze({...passport,status:nextStatus,events:[...(passport.events||[]),{
  id:clean(event.id),type,timestamp:event.timestamp||new Date().toISOString(),
  actorId:event.actorId||null,sourceId:event.sourceId||null,
  evidenceHash:event.evidenceHash||null,referenceId:event.referenceId||null,
  note:event.note||null
 }]});
}

export function linkAssetPassport(passport={},links={}){
 if(!passport.passportId)throw new TypeError('passport is required');
 const allowed=['custodyLotId','facilityId','tradeId','financeId','paymentId','settlementId','shipmentId','insuranceId','assayId'];
 const next={...passport};
 for(const key of allowed)if(links[key]!=null)next[key]=links[key];
 const evidence=[...(passport.evidenceHashes||[])];
 if(Array.isArray(links.evidenceHashes))evidence.push(...links.evidenceHashes);
 next.evidenceHashes=[...new Set(evidence)];
 return Object.freeze(next);
}

export function verifyAssetPassport(passport={},verification={}){
 if(!passport.passportId||!verification.id)throw new TypeError('passport and verification id are required');
 if(!verification.evidenceHash)throw new TypeError('evidenceHash is required');
 return appendPassportEvent({...passport,status:'VERIFIED'},{
  id:verification.id,type:'IDENTITY_VERIFIED',actorId:verification.actorId,
  sourceId:verification.sourceId,evidenceHash:verification.evidenceHash,
  note:verification.note,status:'VERIFIED'
 });
}

export function buildAssetPassportSnapshot(passports=[]){
 return Object.freeze({
  version:GEM_ASSET_PASSPORT_VERSION,
  passportCount:passports.length,
  verified:passports.filter(p=>p.status==='VERIFIED'||p.status==='IN_CUSTODY'||p.status==='ALLOCATED'||p.status==='TRADE_LINKED'||p.status==='SETTLEMENT_LINKED'||p.status==='RELEASED').length,
  inCustody:passports.filter(p=>p.status==='IN_CUSTODY').length,
  tradeLinked:passports.filter(p=>p.tradeId).length,
  settlementLinked:passports.filter(p=>p.settlementId).length,
  disputed:passports.filter(p=>p.status==='DISPUTED').length,
  evidenceLinked:passports.filter(p=>(p.evidenceHashes||[]).length>0).length
 });
}
