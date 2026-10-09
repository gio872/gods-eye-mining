/**
 * GEM IPO Investor Room
 * Investor-facing scenario model and capital-planning primitives.
 * Projections are assumptions, not guarantees, offers or valuations.
 */
export const GEM_INVESTOR_ROOM_VERSION='1.0.0';

export const SCENARIOS=Object.freeze(['CONSERVATIVE','BASE','UPSIDE']);
export const MILESTONE_STAGES=Object.freeze(['PRODUCT','REVENUE','NETWORK','SCALE','PRE_IPO','IPO_READY']);

const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const pct=v=>Math.max(0,Math.min(1,n(v)));

export function buildFiveYearModel(input={}){
 const years=Array.isArray(input.years)&&input.years.length?input.years:[2027,2028,2029,2030,2031];
 const users=n(input.startUsers,50), growth=pct(input.userGrowthRate??0.6);
 const monthly=n(input.monthlyPrice,299), enterprise=n(input.enterpriseCustomers,3);
 const enterpriseGrowth=pct(input.enterpriseGrowthRate??0.5);
 const enterprisePrice=n(input.enterpriseMonthlyPrice,2499);
 const tradeVolume=n(input.tradeVolume,10_000_000), tradeGrowth=pct(input.tradeGrowthRate??1);
 const takeRate=n(input.takeRateBps,15)/10000;
 const rows=years.map((year,i)=>{
   const u=Math.round(users*Math.pow(1+growth,i));
   const ec=Math.round(enterprise*Math.pow(1+enterpriseGrowth,i));
   const tv=tradeVolume*Math.pow(1+tradeGrowth,i);
   const subscription=u*monthly*12;
   const enterpriseRevenue=ec*enterprisePrice*12;
   const transactionRevenue=tv*takeRate;
   const total=subscription+enterpriseRevenue+transactionRevenue;
   const opex=n(input.annualOpex,1_500_000)*Math.pow(1+n(input.opexGrowthRate,0.2),i);
   return Object.freeze({year,users:u,enterpriseCustomers:ec,tradeVolume:Math.round(tv),subscriptionRevenue:Math.round(subscription),enterpriseRevenue:Math.round(enterpriseRevenue),transactionRevenue:Math.round(transactionRevenue),revenue:Math.round(total),opex:Math.round(opex),ebitda:Math.round(total-opex)});
 });
 return Object.freeze({version:GEM_INVESTOR_ROOM_VERSION,currency:input.currency||'USD',assumptions:{users,growth,monthly,enterprise,enterpriseGrowth,enterprisePrice,tradeVolume,tradeGrowth,takeRateBps:input.takeRateBps??15,annualOpex:n(input.annualOpex,1_500_000)},years:rows});
}

export function buildScenarioSet(base={}){
 const presets={
  CONSERVATIVE:{startUsers:50,userGrowthRate:.35,monthlyPrice:299,enterpriseCustomers:3,enterpriseGrowthRate:.25,enterpriseMonthlyPrice:2499,tradeVolume:10e6,tradeGrowthRate:.35,takeRateBps:10,annualOpex:2e6},
  BASE:{startUsers:150,userGrowthRate:.55,monthlyPrice:299,enterpriseCustomers:10,enterpriseGrowthRate:.45,enterpriseMonthlyPrice:2499,tradeVolume:50e6,tradeGrowthRate:.65,takeRateBps:20,annualOpex:2.5e6},
  UPSIDE:{startUsers:400,userGrowthRate:.75,monthlyPrice:299,enterpriseCustomers:25,enterpriseGrowthRate:.65,enterpriseMonthlyPrice:2499,tradeVolume:200e6,tradeGrowthRate:.9,takeRateBps:25,annualOpex:4e6}
 };
 return Object.fromEntries(SCENARIOS.map(s=>[s,buildFiveYearModel({...presets[s],...base})]));
}

export function simulateDilution(input={}){
 const preMoney=n(input.preMoneyValuation), raise=n(input.raiseAmount);
 const postMoney=preMoney+raise;
 const newInvestorOwnership=postMoney?raise/postMoney:0;
 const founderOwnershipAfter=1-newInvestorOwnership;
 return Object.freeze({preMoneyValuation:preMoney,raiseAmount:raise,postMoneyValuation:postMoney,newInvestorOwnership,founderOwnershipAfter,illustrative:true});
}

export function buildUseOfFunds(input={}){
 const total=n(input.totalRaise);
 const allocation=input.allocation||{product:.30,planetaryData:.20,sales:.20,compliance:.10,team:.15,reserve:.05};
 const sum=Object.values(allocation).reduce((a,v)=>a+n(v),0);
 if(Math.abs(sum-1)>.001) throw new RangeError('use-of-funds allocation must total 100%');
 return Object.freeze({totalRaise:total,currency:input.currency||'USD',allocation:Object.fromEntries(Object.entries(allocation).map(([k,v])=>[k,{percent:n(v),amount:Math.round(total*n(v))}]))});
}

export function buildIPOPath(input={}){
 const stages=[
  ['PRODUCT','Core platform and evidence fabric'],
  ['REVENUE','Recurring SaaS and enterprise revenue'],
  ['NETWORK','Assets, counterparties, capital and transaction network'],
  ['SCALE','Auditable financials, controls and international expansion'],
  ['PRE_IPO','Governance, audit, counsel, reporting and data room'],
  ['IPO_READY','Exchange/regulatory criteria satisfied']
 ];
 const completed=new Set(input.completedStages||[]);
 return Object.freeze(stages.map(([id,description],i)=>({stage:id,description,order:i+1,status:completed.has(id)?'COMPLETE':'NEXT'})));
}

export function buildInvestorRoomSnapshot(input={}){
 const scenarios=buildScenarioSet(input.model||{});
 const base=scenarios.BASE;
 const last=base.years.at(-1);
 return Object.freeze({
  version:GEM_INVESTOR_ROOM_VERSION,
  headline:'BUILD THE OPERATING SYSTEM FOR GLOBAL MINERALS',
  revenueYear1:base.years[0]?.revenue||0,
  revenueYear5:last?.revenue||0,
  ebitdaYear5:last?.ebitda||0,
  scenarios,
  dilution:simulateDilution(input.dilution||{}),
  useOfFunds:buildUseOfFunds(input.useOfFunds||{}),
  ipoPath:buildIPOPath(input.ipoPath||{}),
  assumptionsOnly:true,
  disclaimer:'Illustrative projections only. Not historical results, a valuation, an offer to sell securities, or a guaranteed return.'
 });
}
