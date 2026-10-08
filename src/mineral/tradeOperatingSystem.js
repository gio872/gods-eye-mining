/**
 * GEM Trade Operating System.
 * Operational workspace over the marketplace/exchange layers.
 * Tracks pipeline, tasks, documents, revenue and subscription state.
 */
export const GEM_TRADE_OS_VERSION='1.0.0';

export const TRADE_PIPELINE_STAGES=Object.freeze([
 'DISCOVERY','RFQ','QUOTED','MATCHED','CONTRACTED','FINANCED',
 'LOGISTICS','DELIVERED','SETTLEMENT','COMPLETED','DISPUTED','CANCELLED'
]);
export const DOCUMENT_TYPES=Object.freeze([
 'KYC','CORPORATE_REGISTRY','PROOF_OF_FUNDS','PROOF_OF_PRODUCT',
 'ASSAY','CERTIFICATE_OF_ANALYSIS','CONTRACT','INVOICE','PACKING_LIST',
 'BILL_OF_LADING','CERTIFICATE_OF_ORIGIN','INSURANCE','CUSTOMS','SETTLEMENT_PROOF'
]);
export const DOCUMENT_STATUSES=Object.freeze(['REQUESTED','RECEIVED','VERIFIED','REJECTED']);

const clean=v=>String(v??'').trim();

export function createTradeWorkspace(input={}){
 if(!input.id)throw new TypeError('workspace id is required');
 return Object.freeze({
  version:GEM_TRADE_OS_VERSION,id:clean(input.id),tradeId:input.tradeId||null,
  ownerId:input.ownerId||null,stage:input.stage||'DISCOVERY',
  commodity:input.commodity||null,notional:input.notional??null,currency:input.currency||null,
  sellerId:input.sellerId||null,buyerId:input.buyerId||null,
  assignedTeam:Array.isArray(input.assignedTeam)?[...input.assignedTeam]:[],
  createdAt:input.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),
  riskFlags:Array.isArray(input.riskFlags)?[...input.riskFlags]:[],
  provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

export function advanceTradeStage(workspace,stage){
 if(!workspace||!TRADE_PIPELINE_STAGES.includes(stage))throw new RangeError('Unsupported trade stage');
 const current=TRADE_PIPELINE_STAGES.indexOf(workspace.stage||'DISCOVERY');
 const next=TRADE_PIPELINE_STAGES.indexOf(stage);
 if(next<current && !['DISPUTED','CANCELLED'].includes(stage))throw new RangeError('Trade stage cannot move backwards');
 return Object.freeze({...workspace,stage,updatedAt:new Date().toISOString()});
}

export function createTradeDocument(input={}){
 const type=clean(input.type).toUpperCase(),status=clean(input.status||'REQUESTED').toUpperCase();
 if(!input.id||!input.tradeId||!DOCUMENT_TYPES.includes(type))throw new TypeError('id, tradeId and supported document type are required');
 if(!DOCUMENT_STATUSES.includes(status))throw new RangeError('Unsupported document status');
 return Object.freeze({
  version:GEM_TRADE_OS_VERSION,id:clean(input.id),tradeId:clean(input.tradeId),type,
  filename:input.filename||null,uri:input.uri||null,issuer:input.issuer||null,
  status,verifiedBy:input.verifiedBy||null,verifiedAt:input.verifiedAt||null,
  hash:input.hash||null,sourceId:input.sourceId||null,
  provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

export function buildTradeRevenueLedger({trades=[],commissions=[],subscriptions=[]}={}){
 const commissionRevenue=commissions.reduce((s,x)=>s+Number(x.commission||0),0);
 const subscriptionRevenue=subscriptions.reduce((s,x)=>s+Number(x.amount||x.monthlyUsd||0),0);
 const settledNotional=trades.filter(x=>x.stage==='COMPLETED'||x.status==='SETTLED').reduce((s,x)=>s+Number(x.notional||0),0);
 return Object.freeze({
  version:GEM_TRADE_OS_VERSION,tradeCount:trades.length,
  settledNotional,commissionRevenue,subscriptionRevenue,
  totalPlatformRevenue:commissionRevenue+subscriptionRevenue,
  currency:commissions[0]?.currency||subscriptions[0]?.currency||'USD'
 });
}

export function buildTradeOperationsDashboard({workspaces=[],documents=[],trades=[],commissions=[],subscriptions=[]}={}){
 const counts={};
 for(const w of workspaces)counts[w.stage]=(counts[w.stage]||0)+1;
 return Object.freeze({
  version:GEM_TRADE_OS_VERSION,activeTrades:workspaces.filter(w=>!['COMPLETED','CANCELLED'].includes(w.stage)).length,
  stageCounts:counts,pendingDocuments:documents.filter(d=>['REQUESTED','RECEIVED'].includes(d.status)).length,
  verifiedDocuments:documents.filter(d=>d.status==='VERIFIED').length,
  revenue:buildTradeRevenueLedger({trades,commissions,subscriptions})
 });
}
