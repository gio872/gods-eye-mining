/**
 * GEM Commodity Trading & Marketplace Core.
 * Supports physical commodity discovery, offers, bids, matching and
 * transaction economics. It does not execute regulated financial orders,
 * custody funds or represent a completed trade without settlement evidence.
 */
export const GEM_COMMODITY_MARKET_VERSION='1.0.0';

export const COMMODITY_FAMILIES=Object.freeze([
 'MINERALS','BASE_METALS','PRECIOUS_METALS','PLATINUM_GROUP_METALS',
 'RARE_EARTHS','CRITICAL_MINERALS','ENERGY_MINERALS','PETROLEUM','REFINED_PRODUCTS'
]);

export const COMMODITIES=Object.freeze([
 'gold','silver','platinum','palladium','rhodium','iridium','copper','lithium',
 'nickel','cobalt','graphite','manganese','tungsten','tin','niobium','tantalum',
 'vanadium','uranium','chromium','zinc','lead','rare earth elements',
 'petroleum','crude oil','natural gas','gasoline','diesel','jet fuel'
]);

export const MARKET_SIDES=Object.freeze(['OFFER','BID']);
export const MARKET_STATUSES=Object.freeze(['DRAFT','OPEN','MATCHED','SETTLED','CANCELLED']);

const clean=v=>String(v??'').trim();

export function createCommodityListing(input={}){
 const side=clean(input.side).toUpperCase();
 if(!input.id||!input.commodity||!input.unit||!input.currency)throw new TypeError('id, commodity, unit and currency are required');
 if(!MARKET_SIDES.includes(side))throw new RangeError('Unsupported market side');
 if(!COMMODITIES.includes(clean(input.commodity).toLowerCase()))throw new RangeError('Unsupported commodity');
 const quantity=Number(input.quantity),price=Number(input.unitPrice);
 if(!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(price)||price<0)throw new TypeError('quantity and unitPrice must be valid');
 return Object.freeze({
  marketVersion:GEM_COMMODITY_MARKET_VERSION,id:clean(input.id),side,
  commodity:clean(input.commodity).toLowerCase(),family:input.family||null,
  participantId:clean(input.participantId||''),mineId:input.mineId||null,
  originCountry:input.originCountry||null,destinationCountry:input.destinationCountry||null,
  quantity,unit:clean(input.unit),unitPrice:price,currency:clean(input.currency).toUpperCase(),
  incoterm:input.incoterm||null,deliveryWindow:input.deliveryWindow||null,
  quality:input.quality?{...input.quality}:null,
  status:clean(input.status||'OPEN').toUpperCase(),
  verificationStatus:input.verificationStatus||'UNVERIFIED',
  sourceId:input.sourceId||null,provenance:Array.isArray(input.provenance)?[...input.provenance]:[]
 });
}

export function matchCommodityListings(listings=[],criteria={}){
 const wanted=clean(criteria.commodity).toLowerCase();
 return listings.filter(x=>
  x.status==='OPEN' &&
  (!wanted||x.commodity===wanted) &&
  (!criteria.originCountry||x.originCountry===criteria.originCountry) &&
  (!criteria.destinationCountry||x.destinationCountry===criteria.destinationCountry) &&
  (!criteria.unit||x.unit===criteria.unit) &&
  (!criteria.currency||x.currency===criteria.currency)
 ).sort((a,b)=>(a.unitPrice||0)-(b.unitPrice||0));
}

export function createTradeMatch(offer,bid,options={}){
 if(!offer||!bid||offer.side!=='OFFER'||bid.side!=='BID')throw new TypeError('offer and bid sides are required');
 if(offer.commodity!==bid.commodity||offer.unit!==bid.unit||offer.currency!==bid.currency)throw new RangeError('Incompatible commodity terms');
 const quantity=Math.min(offer.quantity,bid.quantity);
 const unitPrice=Number.isFinite(Number(options.unitPrice))?Number(options.unitPrice):Number(bid.unitPrice);
 return Object.freeze({
  id:clean(options.id||'match-'+Date.now().toString(36)),
  marketVersion:GEM_COMMODITY_MARKET_VERSION,commodity:offer.commodity,
  quantity,unit:offer.unit,currency:offer.currency,unitPrice,
  notional:quantity*unitPrice,offerId:offer.id,bidId:bid.id,
  sellerId:offer.participantId||null,buyerId:bid.participantId||null,
  status:'MATCHED',provenance:[...(offer.provenance||[]),...(bid.provenance||[])]
 });
}

export function calculateCommission(notional,rateBps){
 const n=Number(notional),bps=Number(rateBps);
 if(!Number.isFinite(n)||n<0||!Number.isFinite(bps)||bps<0)throw new TypeError('notional and rateBps must be valid');
 return Object.freeze({notional:n,rateBps:bps,commission:n*bps/10000,currency:null});
}

export const GEM_SUBSCRIPTION_PLANS=Object.freeze({
 INTELLIGENCE:{monthlyUsd:0,features:['global intelligence','target discovery']},
 TRADING:{monthlyUsd:299,features:['marketplace','verified counterparties','offers and bids','trade workspace']},
 ENTERPRISE:{monthlyUsd:2499,features:['multi-user','API','private data','advanced due diligence','capital matching']}
});

export function calculateSubscriptionRevenue(activeSubscriptions=[],period='monthly'){
 const total=activeSubscriptions.reduce((s,x)=>s+Number(x.monthlyUsd||0),0);
 return Object.freeze({period,activeSubscriptions:activeSubscriptions.length,recurringRevenueUsd:total});
}
