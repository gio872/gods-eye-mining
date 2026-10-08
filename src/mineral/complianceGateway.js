/**
 * GEM Compliance Gateway.
 * Policy/evidence orchestration for KYC, KYB, AML/KYT, sanctions,
 * Travel Rule, jurisdiction and transaction limits.
 *
 * It is not a legal determination and does not itself perform screening.
 * Production decisions require licensed/authorized compliance providers
 * and jurisdiction-specific policies.
 */
export const GEM_COMPLIANCE_VERSION='1.0.0';

export const COMPLIANCE_CHECKS=Object.freeze([
 'KYC','KYB','AML','KYT','SANCTIONS','TRAVEL_RULE','JURISDICTION','LIMITS'
]);
export const COMPLIANCE_DECISIONS=Object.freeze([
 'PENDING','PASS','HOLD','REJECT','ESCALATE'
]);

const clean=v=>String(v??'').trim();
const upper=v=>clean(v).toUpperCase();

export function createComplianceCase(input={}){
 if(!input.id||!input.subjectId||!input.subjectType)throw new TypeError('id, subjectId and subjectType are required');
 return Object.freeze({
  version:GEM_COMPLIANCE_VERSION,id:clean(input.id),subjectId:clean(input.subjectId),
  subjectType:upper(input.subjectType),tradeId:input.tradeId||null,paymentId:input.paymentId||null,
  jurisdiction:input.jurisdiction||null,checks:Object.fromEntries(COMPLIANCE_CHECKS.map(k=>[k,'PENDING'])),
  decision:'PENDING',riskScore:null,reviewRequired:false,
  evidence:Array.isArray(input.evidence)?[...input.evidence]:[],
  providerCases:Array.isArray(input.providerCases)?[...input.providerCases]:[],
  createdAt:input.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),
  provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

export function addComplianceEvidence(caseRecord={},evidence={}){
 if(!caseRecord?.id||!evidence.id||!evidence.type)throw new TypeError('case and evidence id/type are required');
 return Object.freeze({
  ...caseRecord,evidence:[...(caseRecord.evidence||[]),{
   id:clean(evidence.id),type:upper(evidence.type),status:upper(evidence.status||'RECEIVED'),
   sourceId:evidence.sourceId||null,sourceUrl:evidence.sourceUrl||null,
   hash:evidence.hash||null,issuedAt:evidence.issuedAt||null,expiresAt:evidence.expiresAt||null
  }],updatedAt:new Date().toISOString()
 });
}

export function recordComplianceCheck(caseRecord={},check,result={}){
 const key=upper(check);
 if(!COMPLIANCE_CHECKS.includes(key))throw new RangeError('Unsupported compliance check');
 const state=upper(result.state||'PENDING');
 if(!['PENDING','PASS','FAIL','NOT_APPLICABLE'].includes(state))throw new RangeError('Unsupported check state');
 const checks={...(caseRecord.checks||{}),[key]:state};
 return Object.freeze({...caseRecord,checks,updatedAt:new Date().toISOString(),
  providerCases:[...(caseRecord.providerCases||[]),{
   check:key,providerId:result.providerId||null,reference:result.reference||null,
   checkedAt:result.checkedAt||new Date().toISOString(),sourceId:result.sourceId||null
  }]});
}

export function evaluateComplianceCase(caseRecord={},policy={}){
 const checks=caseRecord.checks||{};
 const failed=COMPLIANCE_CHECKS.filter(k=>checks[k]==='FAIL');
 const pending=COMPLIANCE_CHECKS.filter(k=>checks[k]==='PENDING');
 const jurisdictionBlocked=policy.blockedJurisdictions?.includes(caseRecord.jurisdiction);
 const limitExceeded=policy.limitExceeded===true;
 let decision='PENDING';
 if(failed.length||jurisdictionBlocked||limitExceeded)decision=policy.escalateOnFailure?'ESCALATE':'REJECT';
 else if(pending.length)decision='PENDING';
 else decision='PASS';
 return Object.freeze({...caseRecord,decision,reviewRequired:decision!=='PASS',
  riskScore:Number.isFinite(Number(policy.riskScore))?Number(policy.riskScore):null,
  decisionReason:{failed, pending, jurisdictionBlocked:Boolean(jurisdictionBlocked),limitExceeded},
  updatedAt:new Date().toISOString()});
}

export function authorizeTransaction(caseRecord={},transaction={},policy={}){
 const evaluated=evaluateComplianceCase(caseRecord,policy);
 const amount=Number(transaction.amount);
 const max=Number(policy.maxTransactionAmount);
 const limitBlocked=Number.isFinite(max)&&Number.isFinite(amount)&&amount>max;
 if(evaluated.decision==='PASS'&&!limitBlocked)
  return Object.freeze({authorized:true,decision:'PASS',caseId:caseRecord.id,transactionId:transaction.id||null});
 return Object.freeze({authorized:false,decision:limitBlocked?'HOLD':evaluated.decision,caseId:caseRecord.id,transactionId:transaction.id||null,reason:limitBlocked?'TRANSACTION_LIMIT_EXCEEDED':evaluated.decision});
}

export function buildComplianceSnapshot(cases=[]){
 return Object.freeze({
  version:GEM_COMPLIANCE_VERSION,totalCases:cases.length,
  pending:cases.filter(c=>c.decision==='PENDING').length,
  passed:cases.filter(c=>c.decision==='PASS').length,
  held:cases.filter(c=>c.decision==='HOLD').length,
  rejected:cases.filter(c=>c.decision==='REJECT').length,
  escalated:cases.filter(c=>c.decision==='ESCALATE').length,
  evidenceItems:cases.reduce((n,c)=>n+(c.evidence?.length||0),0)
 });
}
