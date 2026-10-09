/**
 * GEM Physical Asset Digital Twin.
 * Provider-neutral state projection built from independently evidenced events.
 * A twin is a digital representation, not proof of ownership, value, custody or settlement.
 */
export const GEM_ASSET_TWIN_VERSION='1.0.0';

export const TWIN_STATES=Object.freeze([
 'IDENTIFIED','ORIGIN_VALIDATED','ASSAY_VALIDATED','IN_TRANSIT','IN_CUSTODY',
 'ALLOCATED','TRADE_COMMITTED','FINANCED','SETTLEMENT_PENDING','RELEASE_READY',
 'RELEASED','TRANSFERRED','DISPUTED','HOLD'
]);

export const TWIN_EVENT_TYPES=Object.freeze([
 'ORIGIN','ASSAY','CUSTODY','LOCATION','SHIPMENT','OWNERSHIP','TRADE',
 'FINANCE','PAYMENT','SETTLEMENT','INSURANCE','RELEASE','TRANSFER','DISPUTE','HOLD'
]);

const clean=v=>String(v??'').trim();
const upper=v=>clean(v).toUpperCase();

export function createAssetTwin(passport={},options={}){
 if(!passport.passportId||!passport.assetId)throw new TypeError('passport with passportId and assetId is required');
 return Object.freeze({
  version:GEM_ASSET_TWIN_VERSION,
  twinId:clean(options.twinId||`GEM-TWIN-${passport.assetId}`),
  passportId:passport.passportId,
  assetId:passport.assetId,
  commodity:passport.commodity||null,
  assetType:passport.assetType||null,
  state:'IDENTIFIED',
  ownerId:passport.ownerId||null,
  facilityId:passport.facilityId||null,
  location:options.location||null,
  weight:passport.weight??null,
  fineWeight:passport.fineWeight??null,
  purity:passport.purity??null,
  declaredValue:passport.declaredValue??null,
  currency:passport.currency||'USD',
  links:{
   custodyLotId:passport.custodyLotId||null,shipmentId:passport.shipmentId||null,
   tradeId:passport.tradeId||null,financeId:passport.financeId||null,
   paymentId:passport.paymentId||null,settlementId:passport.settlementId||null
  },
  evidenceHashes:[...(passport.evidenceHashes||[])],
  events:[],
  createdAt:options.createdAt||new Date().toISOString()
 });
}

function deriveState(twin,event){
 if(event.state&&TWIN_STATES.includes(upper(event.state)))return upper(event.state);
 switch(upper(event.type)){
  case 'ORIGIN': return 'ORIGIN_VALIDATED';
  case 'ASSAY': return 'ASSAY_VALIDATED';
  case 'SHIPMENT': return 'IN_TRANSIT';
  case 'CUSTODY': return 'IN_CUSTODY';
  case 'TRADE': return 'TRADE_COMMITTED';
  case 'FINANCE': return 'FINANCED';
  case 'SETTLEMENT': return 'SETTLEMENT_PENDING';
  case 'RELEASE': return 'RELEASED';
  case 'TRANSFER': return 'TRANSFERRED';
  case 'DISPUTE': return 'DISPUTED';
  case 'HOLD': return 'HOLD';
  default: return twin.state;
 }
}

export function applyTwinEvent(twin={},event={}){
 if(!twin.twinId||!event.id||!event.type)throw new TypeError('twin, event id and type are required');
 const type=upper(event.type);
 if(!TWIN_EVENT_TYPES.includes(type))throw new RangeError('Unsupported twin event');
 if(event.state&&!TWIN_STATES.includes(upper(event.state)))throw new RangeError('Unsupported twin state');
 const hashes=[...(twin.evidenceHashes||[])];
 if(event.evidenceHash)hashes.push(event.evidenceHash);
 const next={...twin,state:deriveState(twin,event),evidenceHashes:[...new Set(hashes)]};
 if(event.ownerId!=null)next.ownerId=event.ownerId;
 if(event.facilityId!=null)next.facilityId=event.facilityId;
 if(event.location!=null)next.location=event.location;
 if(event.links)next.links={...twin.links,...event.links};
 if(event.weight!=null)next.weight=event.weight;
 if(event.fineWeight!=null)next.fineWeight=event.fineWeight;
 if(event.purity!=null)next.purity=event.purity;
 if(event.declaredValue!=null)next.declaredValue=event.declaredValue;
 next.events=[...(twin.events||[]),{
  id:clean(event.id),type,timestamp:event.timestamp||new Date().toISOString(),
  actorId:event.actorId||null,sourceId:event.sourceId||null,
  evidenceHash:event.evidenceHash||null,referenceId:event.referenceId||null,
  note:event.note||null
 }];
 return Object.freeze(next);
}

export function buildTwinIntegrity(twin={}){
 const events=twin.events||[];
 const evidenced=events.filter(e=>e.evidenceHash||e.sourceId).length;
 const disputes=events.filter(e=>e.type==='DISPUTE').length;
 const holds=events.filter(e=>e.type==='HOLD').length;
 const linked=Object.values(twin.links||{}).filter(Boolean).length;
 return Object.freeze({
  twinId:twin.twinId,eventCount:events.length,evidencedEventCount:evidenced,
  evidenceCoverage:events.length?evidenced/events.length:0,linkedSystemCount:linked,
  disputes,holds,state:twin.state,
  integrityStatus:disputes||holds?'REVIEW_REQUIRED':events.length?'EVIDENCE_TRACKED':'IDENTITY_ONLY'
 });
}

export function buildTwinSnapshot(twins=[]){
 return Object.freeze({
  version:GEM_ASSET_TWIN_VERSION,twinCount:twins.length,
  inCustody:twins.filter(t=>t.state==='IN_CUSTODY').length,
  inTransit:twins.filter(t=>t.state==='IN_TRANSIT').length,
  tradeCommitted:twins.filter(t=>t.state==='TRADE_COMMITTED').length,
  settlementPending:twins.filter(t=>t.state==='SETTLEMENT_PENDING').length,
  released:twins.filter(t=>t.state==='RELEASED').length,
  disputed:twins.filter(t=>t.state==='DISPUTED').length,
  hold:twins.filter(t=>t.state==='HOLD').length
 });
}
