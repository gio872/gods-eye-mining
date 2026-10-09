/**
 * GEM Global Secure Logistics.
 * Provider-neutral orchestration for valuables, precious metals, cash,
 * diamonds/jewellery and other high-value cargo.
 *
 * It records logistics state and chain-of-custody evidence. It does not
 * provide physical security or claim a carrier has accepted a shipment
 * unless external evidence confirms it.
 */
export const GEM_SECURE_LOGISTICS_VERSION='1.0.0';

export const VALUABLE_CARGO_TYPES=Object.freeze([
 'CASH','GOLD','SILVER','PLATINUM','PALLADIUM','RHODIUM','IRIDIUM',
 'DIAMONDS','JEWELLERY','GEMS','PRECIOUS_METALS','SECURITIES','HIGH_VALUE_GOODS'
]);
export const SECURE_LOGISTICS_MODES=Object.freeze(['ARMORED_ROAD','AIR','SEA','COURIER','HAND_CARRY','MULTIMODAL']);
export const SHIPMENT_STATUSES=Object.freeze([
 'QUOTE_REQUESTED','QUOTED','BOOKED','PICKUP_PENDING','IN_CUSTODY',
 'IN_TRANSIT','CUSTOMS','SECURE_STORAGE','OUT_FOR_DELIVERY','DELIVERED',
 'EXCEPTION','CANCELLED'
]);
export const CUSTODY_EVENTS=Object.freeze([
 'BOOKING','PICKUP','WEIGHED','SEALED','HANDOFF','AIRPORT_RECEIPT',
 'CUSTOMS_RELEASE','VAULT_IN','VAULT_OUT','DELIVERY','INSPECTION','EXCEPTION'
]);

const clean=v=>String(v??'').trim();
const upper=v=>clean(v).toUpperCase();

export function createSecureLogisticsProvider(input={}){
 if(!input.id||!input.name)throw new TypeError('id and name are required');
 return Object.freeze({
  version:GEM_SECURE_LOGISTICS_VERSION,id:clean(input.id),name:clean(input.name),
  status:input.status||'CATALOGED',coverage:Array.isArray(input.coverage)?[...input.coverage]:[],
  cargoTypes:Array.isArray(input.cargoTypes)?input.cargoTypes.map(upper):[],
  modes:Array.isArray(input.modes)?input.modes.map(upper):[],
  services:Array.isArray(input.services)?[...input.services]:[],
  tracking:input.tracking===true,insurance:input.insurance||'NOT_SPECIFIED',
  vaulting:input.vaulting===true,customs:input.customs===true,
  apiReady:input.apiReady===true,apiEndpoint:input.apiEndpoint||null,
  sourceId:input.sourceId||null,sourceUrl:input.sourceUrl||null,
  verificationStatus:input.verificationStatus||'PUBLIC_SOURCE_RECORDED',
  provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

export function createValuablesShipment(input={}){
 const value=Number(input.declaredValue);
 if(!input.id||!input.cargoType||!input.origin||!input.destination||!Number.isFinite(value)||value<=0)
  throw new TypeError('id, cargoType, origin, destination and positive declaredValue are required');
 const cargoType=upper(input.cargoType);
 if(!VALUABLE_CARGO_TYPES.includes(cargoType))throw new RangeError('Unsupported valuables cargo type');
 return Object.freeze({
  version:GEM_SECURE_LOGISTICS_VERSION,id:clean(input.id),tradeId:input.tradeId||null,
  cargoType,description:input.description||null,quantity:input.quantity??null,unit:input.unit||null,
  declaredValue:value,currency:upper(input.currency||'USD'),
  origin:input.origin,destination:input.destination,
  mode:input.mode||'MULTIMODAL',providerId:input.providerId||null,
  insuranceRequired:input.insuranceRequired!==false,insuranceReference:null,
  customsRequired:input.customsRequired!==false,trackingReference:null,
  status:'QUOTE_REQUESTED',chainOfCustody:[],
  riskProfile:{securityLevel:input.securityLevel||'HIGH',routeRisk:input.routeRisk||'UNKNOWN'},
  provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

export function addCustodyEvent(shipment={},event={}){
 const type=upper(event.type);
 if(!shipment?.id||!CUSTODY_EVENTS.includes(type)||!event.location)
  throw new TypeError('shipment, supported event type and location are required');
 const record={
  id:clean(event.id||'custody-'+Date.now().toString(36)),type,
  location:event.location,timestamp:event.timestamp||new Date().toISOString(),
  actorId:event.actorId||null,sealReference:event.sealReference||null,
  weight:event.weight??null,condition:event.condition||null,
  externalReference:event.externalReference||null,
  evidenceHash:event.evidenceHash||null,sourceId:event.sourceId||null
 };
 return Object.freeze({...shipment,chainOfCustody:[...(shipment.chainOfCustody||[]),record]});
}

export function advanceShipment(shipment={},status,external={}){
 const current=SHIPMENT_STATUSES.indexOf(shipment.status||'QUOTE_REQUESTED');
 const next=SHIPMENT_STATUSES.indexOf(status);
 if(next<0)throw new RangeError('Unsupported shipment status');
 if(next<current&&!['EXCEPTION','CANCELLED'].includes(status))throw new RangeError('Shipment status cannot move backwards');
 return Object.freeze({...shipment,status,trackingReference:external.trackingReference||shipment.trackingReference,
  insuranceReference:external.insuranceReference||shipment.insuranceReference,
  updatedAt:new Date().toISOString()});
}

export function requestLogisticsQuote(input={}){
 const value=Number(input.declaredValue);
 if(!input.id||!input.origin||!input.destination||!Number.isFinite(value)||value<=0)
  throw new TypeError('quote requires id, origin, destination and declared value');
 return Object.freeze({
  version:GEM_SECURE_LOGISTICS_VERSION,id:clean(input.id),shipmentId:input.shipmentId||null,
  providerId:input.providerId||null,origin:input.origin,destination:input.destination,
  cargoType:input.cargoType||null,declaredValue:value,currency:upper(input.currency||'USD'),
  mode:input.mode||null,insuranceRequired:input.insuranceRequired!==false,
  customsRequired:input.customsRequired!==false,status:'QUOTE_REQUESTED',
  quoteAmount:null,quoteCurrency:null,validUntil:null,externalReference:null,
  provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

export function matchSecureLogisticsProviders(shipment={},providers=[]){
 return providers.filter(p=>
  (!shipment.cargoType||p.cargoTypes?.includes(upper(shipment.cargoType))) &&
  (!shipment.mode||p.modes?.includes(upper(shipment.mode))) &&
  p.status!=='DISABLED'
 ).map(p=>({
  provider:p,
  matchScore:
   (p.tracking?20:0)+(p.insurance&&p.insurance!=='NOT_SPECIFIED'?20:0)+
   (p.vaulting?15:0)+(p.customs?15:0)+(p.apiReady?10:0)
  })).sort((a,b)=>b.matchScore-a.matchScore);
}

export function buildSecureLogisticsSnapshot({shipments=[],providers=[],custodyEvents=[]}={}){
 return Object.freeze({
  version:GEM_SECURE_LOGISTICS_VERSION,shipmentCount:shipments.length,
  activeShipments:shipments.filter(s=>!['DELIVERED','CANCELLED'].includes(s.status)).length,
  inCustody:shipments.filter(s=>['IN_CUSTODY','IN_TRANSIT','CUSTOMS','SECURE_STORAGE','OUT_FOR_DELIVERY'].includes(s.status)).length,
  delivered:shipments.filter(s=>s.status==='DELIVERED').length,
  exceptions:shipments.filter(s=>s.status==='EXCEPTION').length,
  providerCount:providers.length,custodyEventCount:custodyEvents.length
 });
}
