/**
 * GEM Global Capital & Financing Network.
 * Public-safe registry of capital providers and financing instruments.
 */
export const GEM_CAPITAL_NETWORK_VERSION='1.0.0';

export const CAPITAL_PROVIDER_TYPES=Object.freeze([
 'COMMERCIAL_BANK','DEVELOPMENT_BANK','EXPORT_CREDIT_AGENCY','SOVEREIGN_WEALTH_FUND',
 'PENSION_FUND','PRIVATE_EQUITY','VENTURE_CAPITAL','GROWTH_CAPITAL','COMMODITY_FUND',
 'HEDGE_FUND','FAMILY_OFFICE','ASSET_MANAGER','INSURER','FINTECH','LENDER',
 'ROYALTY_STREAMER','MINING_FINANCE_SPECIALIST','INVESTMENT_BANK','BROKER_DEALER'
]);

export const FINANCING_INSTRUMENTS=Object.freeze([
 'PROJECT_FINANCE','CORPORATE_LOAN','TERM_LOAN','REVOLVING_CREDIT','TRADE_FINANCE',
 'PREPAYMENT','STREAMING','ROYALTY','EQUITY','PRIVATE_PLACEMENT','BOND',
 'CONVERTIBLE','VENTURE_EQUITY','EXPORT_FINANCE','WORKING_CAPITAL','SBLC','GUARANTEE'
]);

export function createCapitalProvider(input={}){
 const type=String(input.type||'').toUpperCase();
 if(!input.id||!input.name||!input.country)throw new TypeError('id, name and country are required');
 if(!CAPITAL_PROVIDER_TYPES.includes(type))throw new RangeError('Unsupported capital provider type');
 return Object.freeze({
  networkVersion:GEM_CAPITAL_NETWORK_VERSION,id:String(input.id),name:String(input.name),
  legalName:input.legalName||null,country:String(input.country),region:input.region||null,type,
  headquarters:input.headquarters||null,
  commodities:Array.isArray(input.commodities)?[...new Set(input.commodities.map(String))]:[],
  geographies:Array.isArray(input.geographies)?[...new Set(input.geographies.map(String))]:[],
  instruments:Array.isArray(input.instruments)?[...new Set(input.instruments.map(String).filter(x=>FINANCING_INSTRUMENTS.includes(x)))] : [],
  sectors:Array.isArray(input.sectors)?[...new Set(input.sectors.map(String))]:[],
  ticketMin:input.ticketMin??null,ticketMax:input.ticketMax??null,currency:input.currency||null,
  stage:input.stage||null,website:input.website||null,
  sourceId:input.sourceId||null,sourceUrl:input.sourceUrl||null,sourceDate:input.sourceDate||null,
  verificationStatus:input.verificationStatus||'UNVERIFIED',
  provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

export function matchCapitalProviders(providers=[],criteria={}){
 return providers.filter(p=>
  (!criteria.country||p.country===criteria.country) &&
  (!criteria.type||p.type===criteria.type) &&
  (!criteria.commodity||p.commodities?.includes(criteria.commodity)) &&
  (!criteria.instrument||p.instruments?.includes(criteria.instrument)) &&
  (!criteria.geography||p.geographies?.includes(criteria.geography))
 );
}

export function buildCapitalCoverage(providers=[]){
 const types={},instruments={};
 for(const p of providers){
  types[p.type]=(types[p.type]||0)+1;
  for(const i of p.instruments||[])instruments[i]=(instruments[i]||0)+1;
 }
 return Object.freeze({providerCount:providers.length,types,instruments});
}
