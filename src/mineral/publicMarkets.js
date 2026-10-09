/**
 * GEM Public Company & IPO Readiness.
 * Governance/data structures for future equity financing and listing preparation.
 * This module does not constitute a securities offering, exchange admission,
 * broker-dealer service, or legal/regulatory approval.
 */
export const GEM_PUBLIC_MARKETS_VERSION='1.0.0';

export const SECURITY_TYPES=Object.freeze([
 'COMMON_SHARE','PREFERRED_SHARE','SAFE','CONVERTIBLE_NOTE','OPTION','WARRANT'
]);

export const LISTING_STAGES=Object.freeze([
 'PRIVATE','PRE_IPO','REGULATORY_REVIEW','LISTING_READY','LISTED'
]);

const clean=v=>String(v??'').trim();
const upper=v=>clean(v).toUpperCase();

export function createShareholder(input={}){
 if(!input.id||!input.name)throw new TypeError('id and name are required');
 const shares=Number(input.shares||0);
 if(!Number.isFinite(shares)||shares<0)throw new TypeError('shares must be non-negative');
 return Object.freeze({
  id:clean(input.id),name:clean(input.name),entityType:input.entityType||'ENTITY',
  shares,securityType:upper(input.securityType||'COMMON_SHARE'),
  jurisdiction:input.jurisdiction||null,verified:input.verified===true,
  sourceId:input.sourceId||null
 });
}

export function buildCapTable(shareholders=[],options={}){
 const total=shareholders.reduce((s,x)=>s+Number(x.shares||0),0);
 return Object.freeze({
  version:GEM_PUBLIC_MARKETS_VERSION,
  asOf:options.asOf||new Date().toISOString(),
  authorizedShares:options.authorizedShares??null,
  issuedShares:total,
  shareholders:shareholders.map(s=>Object.freeze({...s,ownershipPercent:total?Number(s.shares||0)/total:0})),
  employeePoolShares:options.employeePoolShares??0,
  reservedShares:options.reservedShares??0,
  sourceId:options.sourceId||null
 });
}

export function createListingReadiness(input={}){
 const checks=Object.freeze({
  legalEntity:input.legalEntity===true,
  auditedFinancials:input.auditedFinancials===true,
  boardGovernance:input.boardGovernance===true,
  capTable:input.capTable===true,
  beneficialOwnership:input.beneficialOwnership===true,
  financialControls:input.financialControls===true,
  taxCompliance:input.taxCompliance===true,
  materialContracts:input.materialContracts===true,
  riskDisclosure:input.riskDisclosure===true,
  regulatoryCounsel:input.regulatoryCounsel===true,
  exchangeCriteria:input.exchangeCriteria===true,
  reportingInfrastructure:input.reportingInfrastructure===true
 });
 const passed=Object.values(checks).filter(Boolean).length;
 return Object.freeze({
  version:GEM_PUBLIC_MARKETS_VERSION,
  stage:upper(input.stage||'PRIVATE'),
  jurisdiction:input.jurisdiction||null,
  targetExchange:input.targetExchange||null,
  checks,passed,totalChecks:Object.keys(checks).length,
  readinessPercent:Math.round((passed/Object.keys(checks).length)*100),
  blockers:Object.entries(checks).filter(([,v])=>!v).map(([k])=>k)
 });
}

export function createEquityRound(input={}){
 if(!input.id||!input.securityType)throw new TypeError('id and securityType are required');
 const type=upper(input.securityType);
 if(!SECURITY_TYPES.includes(type))throw new RangeError('Unsupported security type');
 return Object.freeze({
  version:GEM_PUBLIC_MARKETS_VERSION,id:clean(input.id),securityType:type,
  preMoneyValuation:input.preMoneyValuation??null,amountTarget:input.amountTarget??null,
  pricePerShare:input.pricePerShare??null,sharesOffered:input.sharesOffered??null,
  currency:upper(input.currency||'USD'),minimumInvestment:input.minimumInvestment??null,
  jurisdiction:input.jurisdiction||null,status:upper(input.status||'PLANNED'),
  disclosures:Array.isArray(input.disclosures)?[...input.disclosures]:[],
  sourceId:input.sourceId||null
 });
}

export function buildInvestorMarketSnapshot({capTable=null,readiness=null,rounds=[]}={}){
 return Object.freeze({
  version:GEM_PUBLIC_MARKETS_VERSION,
  issuedShares:capTable?.issuedShares??null,
  shareholderCount:capTable?.shareholders?.length??0,
  listingStage:readiness?.stage||'PRIVATE',
  readinessPercent:readiness?.readinessPercent??0,
  regulatoryBlockers:readiness?.blockers?.length??null,
  plannedRounds:rounds.filter(r=>r.status==='PLANNED').length,
  activeRounds:rounds.filter(r=>r.status==='OPEN').length
 });
}
