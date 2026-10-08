/**
 * GEM Global Supplier Registry.
 * Scope: minerals, metals, precious metals and petroleum.
 *
 * A supplier is an entity/country/facility with documented supply activity.
 * Discovery is separated from verification; GEM never fabricates a supplier.
 */
export const GEM_SUPPLIER_REGISTRY_VERSION='1.0.0';

export const SUPPLIER_COMMODITY_FAMILIES=Object.freeze([
 'MINERALS','BASE_METALS','PRECIOUS_METALS','PLATINUM_GROUP_METALS',
 'CRITICAL_MINERALS','RARE_EARTHS','ENERGY_MINERALS','PETROLEUM'
]);

export const SUPPLIER_TYPES=Object.freeze([
 'PRODUCER','MINE','REFINER','SMELTER','TRADER','PROCESSOR','RECYCLER',
 'NATIONAL_OIL_COMPANY','OIL_PRODUCER','REFINERY','TERMINAL','SERVICE_PROVIDER'
]);

export function createSupplierRecord(input={}){
 const type=String(input.type||'').toUpperCase();
 const family=String(input.family||'').toUpperCase();
 if(!input.id||!input.name||!input.country)throw new TypeError('id, name and country are required');
 if(!SUPPLIER_TYPES.includes(type))throw new RangeError('Unsupported supplier type');
 if(!SUPPLIER_COMMODITY_FAMILIES.includes(family))throw new RangeError('Unsupported commodity family');
 return Object.freeze({
  registryVersion:GEM_SUPPLIER_REGISTRY_VERSION,
  id:String(input.id),name:String(input.name),legalName:input.legalName||null,
  country:String(input.country),region:input.region||null,type,family,
  commodities:Array.isArray(input.commodities)?[...new Set(input.commodities.map(String))]:[],
  facilities:Array.isArray(input.facilities)?input.facilities.map(f=>({...f})):[],
  capacity:input.capacity??null,capacityUnit:input.capacityUnit||null,
  status:input.status||'UNKNOWN',
  website:input.website||null,
  sourceId:input.sourceId||null,
  sourceUrl:input.sourceUrl||null,
  sourceDate:input.sourceDate||null,
  verificationStatus:input.verificationStatus||'UNVERIFIED',
  provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

export function buildSupplierNetwork(suppliers=[]){
 const byCommodity=new Map(),byCountry=new Map();
 for(const s of suppliers){
  for(const c of s.commodities||[]){const a=byCommodity.get(c)||[];a.push(s.id);byCommodity.set(c,a);}
  const b=byCountry.get(s.country)||[];b.push(s.id);byCountry.set(s.country,b);
 }
 return Object.freeze({
  version:GEM_SUPPLIER_REGISTRY_VERSION,
  supplierCount:suppliers.length,
  commodities:Object.fromEntries(byCommodity),
  countries:Object.fromEntries(byCountry)
 });
}

export function filterSuppliers(suppliers=[],criteria={}){
 return suppliers.filter(s=>
  (!criteria.country||s.country===criteria.country) &&
  (!criteria.family||s.family===criteria.family) &&
  (!criteria.type||s.type===criteria.type) &&
  (!criteria.commodity||s.commodities?.includes(criteria.commodity))
 );
}
