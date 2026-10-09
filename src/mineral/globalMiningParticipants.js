/**
 * GEM Global Mining Participants Registry.
 * Distinguishes the physical asset (mine) from its operator/miner and trader.
 * Discovery and verification are separate; no entity is treated as verified
 * without explicit provenance.
 */
export const GEM_MINING_PARTICIPANTS_VERSION='1.0.0';

export const MINING_PARTICIPANT_TYPES=Object.freeze([
 'MINER','MINE_OPERATOR','MINE','TRADER','COMMODITY_TRADER','OFFTAKER','PRODUCER'
]);

const clean=v=>String(v??'').trim();

export function createMiningParticipant(input={}){
 const type=clean(input.type).toUpperCase();
 if(!input.id||!input.name||!input.country)throw new TypeError('id, name and country are required');
 if(!MINING_PARTICIPANT_TYPES.includes(type))throw new RangeError('Unsupported mining participant type');
 return Object.freeze({
  registryVersion:GEM_MINING_PARTICIPANTS_VERSION,
  id:clean(input.id), name:clean(input.name), legalName:input.legalName||null,
  type, country:clean(input.country), region:input.region||null,
  commodities:Array.isArray(input.commodities)?[...new Set(input.commodities.map(clean).filter(Boolean))]:[],
  mineIds:Array.isArray(input.mineIds)?[...new Set(input.mineIds.map(clean).filter(Boolean))]:[],
  operatorIds:Array.isArray(input.operatorIds)?[...new Set(input.operatorIds.map(clean).filter(Boolean))]:[],
  tradingRegions:Array.isArray(input.tradingRegions)?[...new Set(input.tradingRegions.map(clean).filter(Boolean))]:[],
  facilities:Array.isArray(input.facilities)?input.facilities.map(f=>({...f})):[],
  production:input.production??null, productionUnit:input.productionUnit||null,
  ownershipShare:input.ownershipShare??null,
  website:input.website||null, status:input.status||'UNKNOWN',
  verificationStatus:input.verificationStatus||'UNVERIFIED',
  sourceId:input.sourceId||null, sourceUrl:input.sourceUrl||null,
  sourceDate:input.sourceDate||null,
  provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

export function buildMiningParticipantNetwork(participants=[]){
 const byType=new Map(),byCommodity=new Map(),byCountry=new Map(),byMine=new Map();
 for(const p of participants){
  const t=byType.get(p.type)||[];t.push(p.id);byType.set(p.type,t);
  const c=byCountry.get(p.country)||[];c.push(p.id);byCountry.set(p.country,c);
  for(const mineral of p.commodities||[]){const a=byCommodity.get(mineral)||[];a.push(p.id);byCommodity.set(mineral,a);}
  for(const mine of p.mineIds||[]){const a=byMine.get(mine)||[];a.push(p.id);byMine.set(mine,a);}
 }
 return Object.freeze({
  version:GEM_MINING_PARTICIPANTS_VERSION, participantCount:participants.length,
  byType:Object.fromEntries(byType), byCommodity:Object.fromEntries(byCommodity),
  byCountry:Object.fromEntries(byCountry), byMine:Object.fromEntries(byMine)
 });
}

export function filterMiningParticipants(participants=[],criteria={}){
 return participants.filter(p=>
  (!criteria.country||p.country===criteria.country) &&
  (!criteria.type||p.type===criteria.type) &&
  (!criteria.commodity||p.commodities?.includes(criteria.commodity)) &&
  (!criteria.mineId||p.mineIds?.includes(criteria.mineId)) &&
  (!criteria.verificationStatus||p.verificationStatus===criteria.verificationStatus)
 );
}

export function buildMiningParticipantEdges(participants=[]){
 const edges=[];
 for(const p of participants){
  for(const mineId of p.mineIds||[]) edges.push({
   source:p.id,target:mineId,relation:p.type==='TRADER'||p.type==='COMMODITY_TRADER'?'TRADES_FROM':'OPERATES',
   participantType:p.type,provenance:p.provenance||[]
  });
  for(const operatorId of p.operatorIds||[]) edges.push({
   source:p.id,target:operatorId,relation:'OPERATED_BY',participantType:p.type,provenance:p.provenance||[]
  });
 }
 return edges;
}
