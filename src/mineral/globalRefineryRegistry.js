/**
 * GEM Global Refinery Intelligence.
 * Registry for mineral, metal and petroleum processing facilities.
 */
export const GEM_REFINERY_REGISTRY_VERSION='1.0.0';
export const REFINERY_FAMILIES=Object.freeze(['MINERAL','METAL','PRECIOUS_METAL','PGM','PETROLEUM']);
export const FACILITY_TYPES=Object.freeze(['CONCENTRATOR','SMELTER','REFINERY','SEPARATION_PLANT','HYDROMETALLURGICAL_PLANT','PROCESSING_PLANT','OIL_REFINERY','UPGRADER','TERMINAL']);

export function createRefineryRecord(input={}){
 const family=String(input.family||'').toUpperCase(),type=String(input.type||'').toUpperCase();
 if(!input.id||!input.name||!input.country)throw new TypeError('id, name and country are required');
 if(!REFINERY_FAMILIES.includes(family))throw new RangeError('Unsupported refinery family');
 if(!FACILITY_TYPES.includes(type))throw new RangeError('Unsupported facility type');
 return Object.freeze({
  registryVersion:GEM_REFINERY_REGISTRY_VERSION,id:String(input.id),name:String(input.name),
  operator:input.operator||null,country:String(input.country),region:input.region||null,
  family,type,commodities:Array.isArray(input.commodities)?[...new Set(input.commodities.map(String))]:[],
  capacity:input.capacity??null,capacityUnit:input.capacityUnit||null,
  annualThroughput:input.annualThroughput??null,status:input.status||'UNKNOWN',
  latitude:input.latitude??null,longitude:input.longitude??null,
  sourceId:input.sourceId||null,sourceUrl:input.sourceUrl||null,sourceDate:input.sourceDate||null,
  verificationStatus:input.verificationStatus||'UNVERIFIED',
  provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

export function findRefineries(refineries=[],criteria={}){
 return refineries.filter(r=>
  (!criteria.country||r.country===criteria.country)&&
  (!criteria.family||r.family===criteria.family)&&
  (!criteria.commodity||r.commodities?.includes(criteria.commodity))&&
  (!criteria.type||r.type===criteria.type)
 );
}

export function buildRefineryCapacityMap(refineries=[]){
 const map=new Map();
 for(const r of refineries)for(const c of r.commodities||[]){
  const k=c.toLowerCase();const a=map.get(k)||[];a.push({id:r.id,country:r.country,capacity:r.capacity,unit:r.capacityUnit,status:r.status});map.set(k,a);
 }
 return Object.fromEntries(map);
}
