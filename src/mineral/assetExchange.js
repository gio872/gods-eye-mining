/**
 * GEM Global Asset Exchange Layer.
 * Discovery and matching for physical mineral assets.
 * Matching is an intent/compatibility signal, not a completed trade or settlement.
 */
export const GEM_ASSET_EXCHANGE_VERSION='1.0.0';

export const ASSET_MARKET_SIDES=Object.freeze(['OFFER','BID']);
export const ASSET_MARKET_STATUSES=Object.freeze(['OPEN','MATCHED','RESERVED','CONTRACTED','SETTLED','CANCELLED','DISPUTED']);

const clean=v=>String(v??'').trim();
const upper=v=>clean(v).toUpperCase();

export function createAssetMarketOrder(input={}){
 if(!input.id||!input.side||!input.commodity)throw new TypeError('id, side and commodity are required');
 const side=upper(input.side);
 if(!ASSET_MARKET_SIDES.includes(side))throw new RangeError('Unsupported market side');
 const quantity=Number(input.quantity);
 if(!Number.isFinite(quantity)||quantity<=0)throw new TypeError('positive quantity is required');
 return Object.freeze({
  version:GEM_ASSET_EXCHANGE_VERSION,id:clean(input.id),side,commodity:upper(input.commodity),
  assetType:input.assetType?upper(input.assetType):null,quantity,unit:input.unit||'kg',
  minPurity:input.minPurity??null,maxPurity:input.maxPurity??null,
  price:input.price??null,currency:upper(input.currency||'USD'),priceBasis:input.priceBasis||null,
  country:input.country||null,facilityId:input.facilityId||null,
  assetIds:Array.isArray(input.assetIds)?[...input.assetIds]:[],
  ownerId:input.ownerId||null,counterpartyId:input.counterpartyId||null,
  financingRequired:input.financingRequired===true,
  logisticsRequired:input.logisticsRequired===true,
  status:'OPEN',tradeId:null,createdAt:input.createdAt||new Date().toISOString(),
  provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

function compatible(a,b){
 if(a.side===b.side||a.commodity!==b.commodity)return false;
 if(a.assetType&&b.assetType&&a.assetType!==b.assetType)return false;
 if(a.country&&b.country&&a.country!==b.country)return false;
 if(a.minPurity!=null&&b.minPurity!=null&&Number(a.minPurity)>Number(b.minPurity))return false;
 if(a.maxPurity!=null&&b.maxPurity!=null&&Number(a.maxPurity)<Number(b.maxPurity))return false;
 return true;
}

export function matchAssetMarketOrders(orders=[]){
 const matches=[];
 for(let i=0;i<orders.length;i++)for(let j=i+1;j<orders.length;j++){
  const a=orders[i],b=orders[j];
  if(!compatible(a,b))continue;
  const offer=a.side==='OFFER'?a:b,bid=a.side==='BID'?a:b;
  const quantity=Math.min(Number(offer.quantity),Number(bid.quantity));
  const price=offer.price!=null&&bid.price!=null
   ? (Number(offer.price)<=Number(bid.price)?Number(offer.price):null):null;
  if(price===null&&offer.price!=null&&bid.price!=null)continue;
  matches.push(Object.freeze({
   id:`GEM-MATCH-${offer.id}-${bid.id}`,offerId:offer.id,bidId:bid.id,
   commodity:offer.commodity,quantity,unit:offer.unit||bid.unit||'kg',
   indicativePrice:price,currency:offer.currency||bid.currency||'USD',
   status:'MATCHED',assetIds:[...new Set([...(offer.assetIds||[]),...(bid.assetIds||[])])],
   financingRequired:offer.financingRequired||bid.financingRequired,
   logisticsRequired:offer.logisticsRequired||bid.logisticsRequired,
   evidenceBackedAssets:Boolean((offer.assetIds||[]).length),
   createdAt:new Date().toISOString()
  }));
 }
 return matches;
}

export function reserveAssetMatch(match={},input={}){
 if(!match.id||match.status!=='MATCHED')throw new RangeError('Only matched intents can be reserved');
 if(!input.reservationId)throw new TypeError('reservationId is required');
 return Object.freeze({...match,status:'RESERVED',reservationId:clean(input.reservationId),reservedAt:new Date().toISOString()});
}

export function linkAssetTrade(match={},tradeId){
 if(!match.id||!tradeId)throw new TypeError('match and tradeId are required');
 return Object.freeze({...match,status:'CONTRACTED',tradeId:clean(tradeId)});
}

export function buildAssetExchangeSnapshot({orders=[],matches=[],assets=[]}={}){
 return Object.freeze({
  version:GEM_ASSET_EXCHANGE_VERSION,openOrders:orders.filter(o=>o.status==='OPEN').length,
  offers:orders.filter(o=>o.side==='OFFER'&&o.status==='OPEN').length,
  bids:orders.filter(o=>o.side==='BID'&&o.status==='OPEN').length,
  matches:matches.length,contracted:matches.filter(m=>m.status==='CONTRACTED').length,
  settled:matches.filter(m=>m.status==='SETTLED').length,
  disputed:matches.filter(m=>m.status==='DISPUTED').length,
  indexedAssets:assets.length
 });
}
