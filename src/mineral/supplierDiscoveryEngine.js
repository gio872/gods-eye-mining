/**
 * GEM Supplier Discovery Engine.
 * Turns heterogeneous public supplier records into ranked, auditable candidates.
 */
export const GEM_SUPPLIER_DISCOVERY_VERSION='1.0.0';

const VALID=['VERIFIED','UNVERIFIED','CONFLICTING'];

function norm(v){return String(v??'').trim().toLowerCase();}
function score(s){
 let x=0;
 if(s.verificationStatus==='VERIFIED')x+=45;
 if(s.sourceId)x+=20;
 if(s.sourceUrl)x+=10;
 if(s.sourceDate)x+=5;
 if(s.country)x+=5;
 if(Array.isArray(s.commodities)&&s.commodities.length)x+=5;
 if(Array.isArray(s.provenance)&&s.provenance.length)x+=10;
 return Math.min(100,x);
}

export function discoverSupplierCandidates(suppliers=[],criteria={}){
 return suppliers
  .filter(s=>s&&(!criteria.country||norm(s.country)===norm(criteria.country)))
  .filter(s=>!criteria.family||s.family===criteria.family)
  .filter(s=>!criteria.commodity||s.commodities?.some(c=>norm(c)===norm(criteria.commodity)))
  .map(s=>({...s,discoveryScore:score(s)}))
  .sort((a,b)=>b.discoveryScore-a.discoveryScore);
}

export function verifySupplierCandidate(candidate,{requiredFields=['name','country','sourceId']}={}){
 const missing=requiredFields.filter(k=>candidate?.[k]==null||candidate[k]==='');
 const status=candidate?.verificationStatus;
 return Object.freeze({
  supplierId:candidate?.id||null,
  validStatus:VALID.includes(status||'UNVERIFIED'),
  missingFields:missing,
  readyForVerification:missing.length===0,
  recommendedStatus:missing.length===0&&status==='VERIFIED'?'VERIFIED':'UNVERIFIED'
 });
}

export function compareSupplierCoverage(suppliers=[],commodities=[]){
 return Object.freeze(Object.fromEntries(commodities.map(c=>[
  c,
  suppliers.filter(s=>s.commodities?.some(x=>norm(x)===norm(c))).length
 ])));
}
