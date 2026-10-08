/**
 * GEM Financial Traceability.
 * Normalizes public transaction/trade/ownership evidence into auditable events.
 * This is an evidence ledger, not a banking or AML determination.
 */
export const GEM_FINANCIAL_TRACEABILITY_VERSION='1.0.0';
export const FINANCIAL_EVENT_TYPES=Object.freeze(['TRADE','PAYMENT','OWNERSHIP','FINANCING','ROYALTY','TAX','INVESTMENT','PROJECT_FINANCE']);

export function createFinancialEvent(input={}){
 const type=String(input.type||'').toUpperCase();
 if(!input.id||!input.date||!input.currency||!Number.isFinite(Number(input.amount)))throw new TypeError('id, date, currency and numeric amount are required');
 if(!FINANCIAL_EVENT_TYPES.includes(type))throw new RangeError('Unsupported financial event type');
 return Object.freeze({
  traceabilityVersion:GEM_FINANCIAL_TRACEABILITY_VERSION,id:String(input.id),type,
  date:String(input.date),currency:String(input.currency).toUpperCase(),
  amount:Number(input.amount),commodity:input.commodity||null,
  originCountry:input.originCountry||null,destinationCountry:input.destinationCountry||null,
  sender:input.sender||null,receiver:input.receiver||null,
  projectId:input.projectId||null,assetId:input.assetId||null,
  instrument:input.instrument||null,reference:input.reference||null,
  sourceId:input.sourceId||null,sourceUrl:input.sourceUrl||null,
  verificationStatus:input.verificationStatus||'UNVERIFIED',
  provenance:Array.isArray(input.provenance)?[...input.provenance]:[],
  privacyClass:input.privacyClass||'PUBLIC'
 });
}

export function buildFinancialTrace(events=[]){
 const nodes=new Map(),links=[];
 for(const e of events){
  const parties=[e.sender,e.receiver,e.originCountry,e.destinationCountry].filter(Boolean);
  parties.forEach(p=>nodes.set(String(p),{id:String(p)}));
  if(e.sender&&e.receiver)links.push({from:String(e.sender),to:String(e.receiver),eventId:e.id,type:e.type,amount:e.amount,currency:e.currency,commodity:e.commodity,sourceId:e.sourceId});
 }
 return Object.freeze({version:GEM_FINANCIAL_TRACEABILITY_VERSION,eventCount:events.length,nodeCount:nodes.size,nodes:[...nodes.values()],links});
}

export function summarizeCommodityFlows(events=[],commodity){
 const filtered=events.filter(e=>!commodity||String(e.commodity||'').toLowerCase()===String(commodity).toLowerCase());
 const total=filtered.reduce((s,e)=>s+Math.abs(Number(e.amount)||0),0);
 return Object.freeze({commodity:commodity||null,eventCount:filtered.length,totalNotional:total,currencies:[...new Set(filtered.map(e=>e.currency))]});
}
