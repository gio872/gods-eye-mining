/**
 * GEM Global Commodity Exchange Layer.
 * Coordinates RFQs, counterparty verification state, contracts,
 * settlement milestones, logistics, insurance and trade finance.
 * It is an orchestration/record layer: it does not custody money or
 * execute regulated financial orders.
 */
export const GEM_EXCHANGE_VERSION='1.0.0';

export const RFQ_STATUSES=Object.freeze(['OPEN','QUOTED','AWARDED','CANCELLED','EXPIRED']);
export const CONTRACT_STATUSES=Object.freeze(['DRAFT','SIGNED','ACTIVE','COMPLETED','CANCELLED','DISPUTED']);
export const SETTLEMENT_STAGES=Object.freeze(['UNFUNDED','FUNDED','DOCUMENTS_PENDING','DOCUMENTS_VERIFIED','DELIVERY_CONFIRMED','SETTLED','FAILED']);
export const LOGISTICS_STATUSES=Object.freeze(['PLANNED','BOOKED','IN_TRANSIT','DELIVERED','EXCEPTION']);
export const FINANCE_STATES=Object.freeze(['REQUESTED','UNDER_REVIEW','APPROVED','FUNDED','REPAID','DECLINED']);

const clean=v=>String(v??'').trim();

export function createCounterpartyProfile(input={}){
 if(!input.id||!input.name||!input.country)throw new TypeError('id, name and country are required');
 return Object.freeze({
  id:clean(input.id),name:clean(input.name),country:clean(input.country),
  legalEntityId:input.legalEntityId||null,participantType:input.participantType||null,
  verificationStatus:input.verificationStatus||'UNVERIFIED',
  verificationDate:input.verificationDate||null,
  sanctionsScreeningStatus:input.sanctionsScreeningStatus||'NOT_CHECKED',
  kycStatus:input.kycStatus||'NOT_CHECKED',
  sourceId:input.sourceId||null,provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

export function createRFQ(input={}){
 if(!input.id||!input.commodity||!input.quantity||!input.unit||!input.currency)throw new TypeError('RFQ requires id, commodity, quantity, unit and currency');
 const q=Number(input.quantity);
 if(!Number.isFinite(q)||q<=0)throw new TypeError('quantity must be positive');
 return Object.freeze({
  exchangeVersion:GEM_EXCHANGE_VERSION,id:clean(input.id),buyerId:input.buyerId||null,
  commodity:clean(input.commodity).toLowerCase(),quantity:q,unit:clean(input.unit),
  currency:clean(input.currency).toUpperCase(),targetPrice:input.targetPrice??null,
  originCountry:input.originCountry||null,destinationCountry:input.destinationCountry||null,
  incoterm:input.incoterm||null,deliveryWindow:input.deliveryWindow||null,
  quality:input.quality?{...input.quality}:null,status:input.status||'OPEN',
  createdAt:input.createdAt||new Date().toISOString(),
  expiresAt:input.expiresAt||null,provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

export function createTradeContract(input={}){
 if(!input.id||!input.tradeId||!input.sellerId||!input.buyerId)throw new TypeError('contract requires id, tradeId, sellerId and buyerId');
 return Object.freeze({
  exchangeVersion:GEM_EXCHANGE_VERSION,id:clean(input.id),tradeId:clean(input.tradeId),
  sellerId:clean(input.sellerId),buyerId:clean(input.buyerId),
  commodity:input.commodity||null,quantity:input.quantity??null,unit:input.unit||null,
  unitPrice:input.unitPrice??null,currency:input.currency||null,incoterm:input.incoterm||null,
  governingLaw:input.governingLaw||null,documents:Array.isArray(input.documents)?[...input.documents]:[],
  status:input.status||'DRAFT',signedAt:input.signedAt||null,
  provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

export function advanceSettlement(settlement={},stage){
 if(!SETTLEMENT_STAGES.includes(stage))throw new RangeError('Unsupported settlement stage');
 const current=SETTLEMENT_STAGES.indexOf(settlement.stage||'UNFUNDED');
 const next=SETTLEMENT_STAGES.indexOf(stage);
 if(next<current)throw new RangeError('Settlement cannot move backwards');
 return Object.freeze({...settlement,exchangeVersion:GEM_EXCHANGE_VERSION,stage,updatedAt:new Date().toISOString()});
}

export function createLogisticsRecord(input={}){
 if(!input.id||!input.tradeId)throw new TypeError('logistics requires id and tradeId');
 return Object.freeze({
  exchangeVersion:GEM_EXCHANGE_VERSION,id:clean(input.id),tradeId:clean(input.tradeId),
  carrier:input.carrier||null,origin:input.origin||null,destination:input.destination||null,
  mode:input.mode||null,containerOrVessel:input.containerOrVessel||null,
  trackingReference:input.trackingReference||null,insuranceProvider:input.insuranceProvider||null,
  insuredValue:input.insuredValue??null,status:input.status||'PLANNED',
  provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

export function createTradeFinanceRequest(input={}){
 if(!input.id||!input.tradeId||!input.applicantId||!input.amount||!input.currency)throw new TypeError('trade finance requires id, tradeId, applicantId, amount and currency');
 return Object.freeze({
  exchangeVersion:GEM_EXCHANGE_VERSION,id:clean(input.id),tradeId:clean(input.tradeId),
  applicantId:clean(input.applicantId),providerId:input.providerId||null,
  instrument:input.instrument||'TRADE_FINANCE',amount:Number(input.amount),
  currency:clean(input.currency).toUpperCase(),maturityDate:input.maturityDate||null,
  state:input.state||'REQUESTED',sourceId:input.sourceId||null,
  provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

export function buildExchangeSnapshot({counterparties=[],rfqs=[],contracts=[],settlements=[],logistics=[],financeRequests=[]}={}){
 return Object.freeze({
  version:GEM_EXCHANGE_VERSION,
  counterparties:counterparties.length,rfqs:rfqs.length,contracts:contracts.length,
  settlements:settlements.length,logistics:logistics.length,financeRequests:financeRequests.length,
  verifiedCounterparties:counterparties.filter(x=>x.verificationStatus==='VERIFIED').length,
  settledTrades:settlements.filter(x=>x.stage==='SETTLED').length,
  fundedTrades:settlements.filter(x=>['FUNDED','DOCUMENTS_PENDING','DOCUMENTS_VERIFIED','DELIVERY_CONFIRMED','SETTLED'].includes(x.stage)).length
 });
}
