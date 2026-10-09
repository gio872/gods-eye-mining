/**
 * GEM Financial Provider Adapter Layer.
 * Defines the contract that banks, PSPs, custodians and digital-asset
 * infrastructure providers must implement before production activation.
 */
export const GEM_PROVIDER_ADAPTER_VERSION='1.0.0';

export const PROVIDER_ENVIRONMENTS=Object.freeze(['sandbox','production']);
export const PROVIDER_CAPABILITIES=Object.freeze([
 'PAY_IN','PAYOUT','BANK_TRANSFER','SWIFT','LOCAL_RAIL','FX',
 'STABLECOIN','CRYPTO','CUSTODY','BALANCE','WEBHOOKS'
]);

const clean=v=>String(v??'').trim();

export function createProviderAdapterProfile(input={}){
 if(!input.id||!input.name||!input.adapterKey)throw new TypeError('id, name and adapterKey are required');
 const environment=input.environment||'sandbox';
 if(!PROVIDER_ENVIRONMENTS.includes(environment))throw new RangeError('Unsupported provider environment');
 return Object.freeze({
  version:GEM_PROVIDER_ADAPTER_VERSION,id:clean(input.id),name:clean(input.name),
  adapterKey:clean(input.adapterKey),environment,enabled:input.enabled===true,
  capabilities:Array.isArray(input.capabilities)?[...input.capabilities]:[],
  currencies:Array.isArray(input.currencies)?[...input.currencies]:[],
  countries:Array.isArray(input.countries)?[...input.countries]:[],
  networks:Array.isArray(input.networks)?[...input.networks]:[],
  credentialRef:input.credentialRef||null,
  webhookSecretRef:input.webhookSecretRef||null,
  productionActivationRequired:true,
  provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

export function validateAdapterContract(adapter={}){
 const required=['id','name','adapterKey','environment'];
 const missing=required.filter(k=>!adapter[k]);
 if(missing.length)throw new Error('Provider adapter incomplete: '+missing.join(', '));
 const unsupported=(adapter.capabilities||[]).filter(c=>!PROVIDER_CAPABILITIES.includes(c));
 if(unsupported.length)throw new RangeError('Unsupported provider capabilities: '+unsupported.join(', '));
 if(adapter.environment==='production'&&adapter.enabled!==true)
  return Object.freeze({ready:false,reason:'PRODUCTION_ACTIVATION_REQUIRED'});
 return Object.freeze({ready:true,reason:'CONTRACT_VALID'});
}

export function createWebhookEvent(input={}){
 if(!input.id||!input.providerId||!input.eventType||!input.externalEventId)
  throw new TypeError('id, providerId, eventType and externalEventId are required');
 return Object.freeze({
  version:GEM_PROVIDER_ADAPTER_VERSION,id:clean(input.id),providerId:clean(input.providerId),
  eventType:clean(input.eventType),externalEventId:clean(input.externalEventId),
  signature:input.signature||null,payloadHash:input.payloadHash||null,
  receivedAt:input.receivedAt||new Date().toISOString(),processed:false,
  idempotencyKey:input.idempotencyKey||clean(input.externalEventId),
  provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

export function markWebhookProcessed(event={},result={}){
 if(!event?.id)throw new TypeError('event id is required');
 return Object.freeze({...event,processed:true,processedAt:new Date().toISOString(),
  result:{status:result.status||'ACCEPTED',reference:result.reference||null}});
}

export function createIdempotencyRecord(input={}){
 if(!input.key||!input.operation)throw new TypeError('key and operation are required');
 return Object.freeze({
  key:clean(input.key),operation:clean(input.operation),
  requestHash:input.requestHash||null,responseReference:input.responseReference||null,
  status:input.status||'IN_PROGRESS',createdAt:input.createdAt||new Date().toISOString()
 });
}

export function buildProviderReadiness(providers=[]){
 return Object.freeze({
  total:providers.length,
  sandbox:providers.filter(p=>p.environment==='sandbox').length,
  productionEnabled:providers.filter(p=>p.environment==='production'&&p.enabled===true).length,
  awaitingActivation:providers.filter(p=>p.productionActivationRequired&&p.enabled!==true).length
 });
}
