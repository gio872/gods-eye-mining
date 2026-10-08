/**
 * GEM Payment Orchestration Layer.
 * Provider-neutral abstraction for fiat, FX, stablecoins and digital assets.
 *
 * IMPORTANT: this module is an orchestration contract. It does not itself
 * become a bank, PSP, VASP, exchange or custodian. Production money movement
 * must be executed by appropriately licensed providers and jurisdiction-aware
 * controls.
 */
export const GEM_PAYMENTS_VERSION='1.0.0';

export const PAYMENT_RAILS=Object.freeze([
 'CARD','BANK_TRANSFER','LOCAL_RAIL','SWIFT','STABLECOIN','CRYPTO'
]);
export const FIAT_CURRENCIES=Object.freeze([
 'USD','EUR','GBP','AED','COP','MXN','BRL','CHF','CAD','AUD','SGD','JPY','CNY','SAR','QAR','CLP','PEN'
]);
export const DIGITAL_ASSETS=Object.freeze([
 'USDC','EURC','USDT','BTC','ETH','XRP','SOL','PYUSD'
]);
export const PAYMENT_STATUSES=Object.freeze([
 'CREATED','COMPLIANCE_REVIEW','AUTHORIZED','PROCESSING','COMPLETED','FAILED','REVERSED','REFUNDED','HELD'
]);
export const PAYMENT_PROVIDERS=Object.freeze([
 'STRIPE','CIRCLE','FIREBLOCKS','BANK','CUSTOM'
]);

const clean=v=>String(v??'').trim();
const currency=v=>clean(v).toUpperCase();

export function createPaymentIntent(input={}){
 if(!input.id||!input.amount||!input.currency||!input.sourceCurrency||!input.destinationCurrency)
  throw new TypeError('id, amount, sourceCurrency and destinationCurrency are required');
 const amount=Number(input.amount);
 if(!Number.isFinite(amount)||amount<=0)throw new TypeError('amount must be positive');
 const sourceCurrency=currency(input.sourceCurrency);
 const destinationCurrency=currency(input.destinationCurrency);
 const assetType=FIAT_CURRENCIES.includes(sourceCurrency)&&FIAT_CURRENCIES.includes(destinationCurrency)
  ? 'FIAT_FX' : DIGITAL_ASSETS.includes(destinationCurrency)||DIGITAL_ASSETS.includes(sourceCurrency) ? 'DIGITAL_ASSET' : 'MIXED';
 return Object.freeze({
  version:GEM_PAYMENTS_VERSION,id:clean(input.id),tradeId:input.tradeId||null,
  customerId:input.customerId||null,amount,sourceCurrency,destinationCurrency,assetType,
  sourceRail:input.sourceRail||null,destinationRail:input.destinationRail||null,
  provider:input.provider||null,providerPaymentId:null,status:'CREATED',
  fxQuoteId:null,network:input.network||null,walletAddress:input.walletAddress||null,
  compliance:{kycStatus:input.kycStatus||'NOT_CHECKED',amlStatus:input.amlStatus||'NOT_CHECKED',sanctionsStatus:input.sanctionsStatus||'NOT_CHECKED',travelRuleStatus:input.travelRuleStatus||'NOT_APPLICABLE'},
  metadata:input.metadata?{...input.metadata}:{},
  provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

export function quoteFx(input={}){
 const from=currency(input.from),to=currency(input.to),rate=Number(input.rate),amount=Number(input.amount);
 if(!from||!to||!Number.isFinite(rate)||rate<=0||!Number.isFinite(amount)||amount<=0)throw new TypeError('from, to, positive amount and positive rate are required');
 const fee=Number(input.fee||0);
 return Object.freeze({
  id:clean(input.id||'fx-'+Date.now().toString(36)),from,to,amount,rate,
  grossDestinationAmount:amount*rate,fee,netDestinationAmount:Math.max(0,amount*rate-fee),
  provider:input.provider||null,expiresAt:input.expiresAt||null,
  sourceId:input.sourceId||null,provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

export function authorizePayment(payment={},checks={}){
 const failed=['kyc','aml','sanctions','travelRule'].filter(k=>checks[k]===false);
 if(failed.length)return Object.freeze({...payment,status:'HELD',compliance:{...(payment.compliance||{}),failedChecks:failed}});
 return Object.freeze({...payment,status:'AUTHORIZED',compliance:{...(payment.compliance||{}),checksPassed:true}});
}

export function selectPaymentRoute({sourceCurrency,destinationCurrency,sourceRail,destinationRail,providers=[]}={}){
 const candidates=providers.filter(p=>
  p.enabled!==false &&
  (!sourceCurrency||p.currencies?.includes(currency(sourceCurrency))) &&
  (!destinationCurrency||p.currencies?.includes(currency(destinationCurrency))) &&
  (!sourceRail||p.rails?.includes(sourceRail)) &&
  (!destinationRail||p.rails?.includes(destinationRail))
 ).map(p=>({...p,routeScore:Number(p.routeScore||0)})).sort((a,b)=>b.routeScore-a.routeScore);
 return candidates;
}

export function buildPaymentsSnapshot({payments=[],fxQuotes=[],providers=[],balances=[]}={}){
 const completed=payments.filter(p=>p.status==='COMPLETED');
 return Object.freeze({
  version:GEM_PAYMENTS_VERSION,
  paymentCount:payments.length,completedPayments:completed.length,
  heldPayments:payments.filter(p=>p.status==='HELD').length,
  totalCompletedNotional:completed.reduce((s,p)=>s+Number(p.amount||0),0),
  fxQuotes:fxQuotes.length,providerCount:providers.length,
  activeProviders:providers.filter(p=>p.enabled!==false).length,
  balances:balances.map(b=>({...b}))
 });
}

export function createProviderProfile(input={}){
 if(!input.id||!input.name||!PAYMENT_PROVIDERS.includes(clean(input.type).toUpperCase()))
  throw new TypeError('id, name and supported provider type are required');
 return Object.freeze({
  id:clean(input.id),name:clean(input.name),type:clean(input.type).toUpperCase(),
  enabled:input.enabled!==false,environment:input.environment||'sandbox',
  currencies:Array.isArray(input.currencies)?input.currencies.map(currency):[],
  rails:Array.isArray(input.rails)?[...input.rails]:[],
  digitalAssets:Array.isArray(input.digitalAssets)?input.digitalAssets.map(currency):[],
  countries:Array.isArray(input.countries)?[...input.countries]:[],
  custody:input.custody||'NONE',sourceId:input.sourceId||null,
  provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}
