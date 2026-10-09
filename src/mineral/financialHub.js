/**
 * GEM Financial Hub.
 * Multi-currency ledger, treasury balances, payout/reconciliation records
 * and compliance evidence states over provider-executed payments.
 */
export const GEM_FINANCIAL_HUB_VERSION='1.0.0';

export const LEDGER_ENTRY_TYPES=Object.freeze([
 'CREDIT','DEBIT','FX_CONVERSION','FEE','REFUND','REVERSAL','SETTLEMENT'
]);
export const RECONCILIATION_STATUSES=Object.freeze([
 'UNMATCHED','MATCHED','EXCEPTION','RESOLVED'
]);
export const COMPLIANCE_STATES=Object.freeze([
 'NOT_CHECKED','PENDING','PASSED','FAILED','ESCALATED'
]);

const clean=v=>String(v??'').trim();
const upper=v=>clean(v).toUpperCase();

export function createTreasuryBalance(input={}){
 if(!input.accountId||!input.currency)throw new TypeError('accountId and currency are required');
 const available=Number(input.available||0),pending=Number(input.pending||0),reserved=Number(input.reserved||0);
 if([available,pending,reserved].some(v=>!Number.isFinite(v)))throw new TypeError('balance values must be numeric');
 return Object.freeze({
  id:clean(input.id||'bal-'+Date.now().toString(36)),accountId:clean(input.accountId),
  currency:upper(input.currency),available,pending,reserved,
  providerId:input.providerId||null,asOf:input.asOf||new Date().toISOString(),
  sourceId:input.sourceId||null,provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

export function createLedgerEntry(input={}){
 const type=upper(input.type);
 const amount=Number(input.amount);
 if(!input.id||!input.accountId||!LEDGER_ENTRY_TYPES.includes(type)||!input.currency||!Number.isFinite(amount)||amount<=0)
  throw new TypeError('id, accountId, valid type, currency and positive amount are required');
 return Object.freeze({
  version:GEM_FINANCIAL_HUB_VERSION,id:clean(input.id),accountId:clean(input.accountId),
  paymentId:input.paymentId||null,tradeId:input.tradeId||null,type,
  amount,currency:upper(input.currency),providerId:input.providerId||null,
  externalReference:input.externalReference||null,reconciliationStatus:'UNMATCHED',
  createdAt:input.createdAt||new Date().toISOString(),
  sourceId:input.sourceId||null,provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

export function reconcileLedgerEntry(entry={},external={}){
 if(!entry?.id||!external?.reference)throw new TypeError('entry id and external reference are required');
 const sameAmount=Math.abs(Number(entry.amount)-Number(external.amount))<1e-9;
 const sameCurrency=upper(entry.currency)===upper(external.currency);
 return Object.freeze({
  ...entry,reconciliationStatus:sameAmount&&sameCurrency?'MATCHED':'EXCEPTION',
  externalReference:clean(external.reference),reconciledAt:new Date().toISOString(),
  reconciliation:{amountMatch:sameAmount,currencyMatch:sameCurrency}
 });
}

export function createPayoutRequest(input={}){
 const amount=Number(input.amount);
 if(!input.id||!input.accountId||!input.destination||!input.currency||!Number.isFinite(amount)||amount<=0)
  throw new TypeError('id, accountId, destination, currency and positive amount are required');
 return Object.freeze({
  version:GEM_FINANCIAL_HUB_VERSION,id:clean(input.id),accountId:clean(input.accountId),
  destination:clean(input.destination),destinationType:input.destinationType||'BANK',
  amount,currency:upper(input.currency),rail:input.rail||null,providerId:input.providerId||null,
  status:'PENDING_COMPLIANCE',externalReference:null,
  compliance:{state:'NOT_CHECKED',checks:[]},
  provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

export function applyComplianceDecision(record={},decision,checks=[]){
 const state=upper(decision);
 if(!COMPLIANCE_STATES.includes(state))throw new RangeError('Unsupported compliance state');
 return Object.freeze({
  ...record,compliance:{state,checks:Array.isArray(checks)?[...checks]:[]},
  status:state==='PASSED'?'READY_FOR_PROVIDER':state==='FAILED'?'HELD':'PENDING_COMPLIANCE'
 });
}

export function createReconciliationBatch(input={}){
 const entries=Array.isArray(input.entries)?input.entries:[];
 const matched=entries.filter(e=>e.reconciliationStatus==='MATCHED').length;
 const exceptions=entries.filter(e=>e.reconciliationStatus==='EXCEPTION').length;
 return Object.freeze({
  id:clean(input.id||'recon-'+Date.now().toString(36)),
  accountId:input.accountId||null,providerId:input.providerId||null,
  entryCount:entries.length,matched,exceptions,
  status:exceptions?'EXCEPTION':'MATCHED',
  createdAt:new Date().toISOString()
 });
}

export function buildFinancialHubSnapshot({balances=[],payments=[],ledger=[],payouts=[],reconciliation=[]}={}){
 const byCurrency={};
 for(const b of balances){
  byCurrency[b.currency]=(byCurrency[b.currency]||0)+Number(b.available||0);
 }
 return Object.freeze({
  version:GEM_FINANCIAL_HUB_VERSION,
  currencies:Object.keys(byCurrency).sort(),
  balancesByCurrency:byCurrency,
  paymentCount:payments.length,
  ledgerEntries:ledger.length,
  pendingPayouts:payouts.filter(p=>p.status!=='COMPLETED').length,
  reconciliationExceptions:reconciliation.filter(r=>r.status==='EXCEPTION').length,
  complianceHolds:payouts.filter(p=>p.compliance?.state==='FAILED').length
 });
}
