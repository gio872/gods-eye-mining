import { buildInvestorRoomSnapshot } from '../mineral/investorRoom.js';
/**
 * GEM Investor Intelligence.
 * Investor-facing value proposition and scenario model.
 * Scenario figures are explicitly projections, not actual financial results or guarantees.
 */
const SCENARIOS={
 CONSERVATIVE:{label:'CONSERVATIVE',users:50,monthly:299,enterprise:3,enterpriseMonthly:2499,tradeVolume:10000000,feeBps:15},
 BASE:{label:'BASE CASE',users:150,monthly:299,enterprise:10,enterpriseMonthly:2499,tradeVolume:50000000,feeBps:20},
 UPSIDE:{label:'UPSIDE',users:400,monthly:299,enterprise:25,enterpriseMonthly:2499,tradeVolume:200000000,feeBps:25}
};
function money(n){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);}
function calc(s){
 const intelligence=s.users*s.monthly;
 const enterprise=s.enterprise*s.enterpriseMonthly;
 const transaction=s.tradeVolume*(s.feeBps/10000);
 return {intelligence,enterprise,transaction,annual:(intelligence+enterprise+transaction)*12};
}
function scenarioCard(key,s){
 const c=calc(s);
 return '<button class="gem-investor-scenario" data-scenario="'+key+'"><b>'+s.label+'</b><span>'+money(c.annual)+'/yr modeled revenue</span><small>'+s.users+' intelligence seats · '+s.enterprise+' enterprise accounts · '+s.feeBps+' bps modeled transaction layer</small></button>';
}
export function installGemInvestorIntelligence(){
 const install=()=>{
  if(document.querySelector('.gem-investor-center'))return;
  const panel=document.createElement('section');panel.className='gem-investor-center';
  const investorSnapshot=buildInvestorRoomSnapshot({dilution:{preMoneyValuation:20000000,raiseAmount:5000000},useOfFunds:{totalRaise:5000000}});
  panel.innerHTML=
   '<div class="gem-investor-room-live">'+buildInvestorRoomPanelMarkup(investorSnapshot)+'</div>'+
   '<div class="gem-investor-head"><div><span>GEM INVESTOR INTELLIGENCE</span><h2>BUILD THE OPERATING SYSTEM FOR GLOBAL MINERALS</h2><p>One platform connecting planetary intelligence, targets, assets, capital, trade, logistics and settlement.</p></div><button data-close>×</button></div>'+
   '<div class="gem-investor-why"><div><b>01</b><strong>DATA MOAT</strong><small>Multi-source planetary evidence becomes proprietary decision infrastructure.</small></div><div><b>02</b><strong>WORKFLOW MOAT</strong><small>Exploration, assets, trade and capital converge in one operating layer.</small></div><div><b>03</b><strong>NETWORK MOAT</strong><small>More assets, counterparties and outcomes increase platform utility.</small></div></div>'+
   '<div class="gem-investor-scenarios"><div class="gem-investor-section">MODELED BUSINESS SCENARIOS</div><div class="gem-investor-cards">'+Object.entries(SCENARIOS).map(([k,s])=>scenarioCard(k,s)).join('')+'</div><div class="gem-investor-breakdown" data-breakdown></div></div>'+
   '<div class="gem-investor-footer"><span>PROJECTION ONLY — NOT HISTORICAL RESULTS, A VALUATION OR A GUARANTEED RETURN.</span><button data-invest>REQUEST INVESTOR BRIEF</button></div>';
  const style=document.createElement('style');style.textContent=[
   '.gem-investor-room-live{margin-bottom:24px}.gem-investor-room{padding:2px}.gem-investor-room__hero{padding:4px 0 18px}.gem-investor-room__eyebrow{color:#58d5e8;font:700 10px ui-monospace,monospace;letter-spacing:.16em}.gem-investor-room__hero h2{margin:8px 0;font-size:27px}.gem-investor-room__hero p{color:#9db5bc;max-width:780px}.gem-investor-room__metrics,.gem-investor-room__cards,.gem-investor-room__split,.gem-investor-room__funds,.gem-investor-room__path{display:grid;gap:10px}.gem-investor-room__metrics{grid-template-columns:repeat(4,1fr)}.gem-investor-room__metrics article,.gem-investor-room__cards article,.gem-investor-room__split>div,.gem-investor-room__funds>div,.gem-investor-room__stage{padding:13px;border:1px solid rgba(130,180,190,.18);border-radius:9px;background:rgba(255,255,255,.025)}.gem-investor-room__metrics small,.gem-investor-room__metrics strong,.gem-investor-room__cards span,.gem-investor-room__cards strong,.gem-investor-room__cards small,.gem-investor-room__split small,.gem-investor-room__split strong,.gem-investor-room__funds span,.gem-investor-room__funds b,.gem-investor-room__funds small,.gem-investor-room__stage b,.gem-investor-room__stage span,.gem-investor-room__stage small{display:block}.gem-investor-room__metrics small,.gem-investor-room__cards small,.gem-investor-room__split small,.gem-investor-room__funds small,.gem-investor-room__stage small{color:#829aa2}.gem-investor-room__metrics strong{margin-top:5px;font-size:18px}.gem-investor-room__section{margin-top:18px}.gem-investor-room__section h3{font-size:13px;margin:0 0 9px}.gem-investor-room__cards{grid-template-columns:repeat(3,1fr)}.gem-investor-room__cards span{font:700 10px ui-monospace,monospace;color:#58d5e8}.gem-investor-room__cards strong{font-size:20px;margin:7px 0}.gem-investor-room__split{grid-template-columns:repeat(3,1fr)}.gem-investor-room__split strong{font-size:18px;margin-top:5px}.gem-investor-room__funds{grid-template-columns:repeat(5,1fr)}.gem-investor-room__funds b{font-size:17px;margin:5px 0}.gem-investor-room__path{grid-template-columns:repeat(6,1fr)}.gem-investor-room__stage.complete{border-color:rgba(88,213,232,.5)}.gem-investor-room__stage b{color:#58d5e8}.gem-investor-room__stage span{font-weight:700;margin:5px 0}.gem-investor-room__disclaimer{margin-top:12px;color:#667f87;font-size:9px}@media(max-width:900px){.gem-investor-room__metrics,.gem-investor-room__cards,.gem-investor-room__split,.gem-investor-room__funds,.gem-investor-room__path{grid-template-columns:1fr 1fr}}.gem-investor-center{position:fixed;inset:8vh 8vw;z-index:15000;display:none;overflow:auto;padding:28px;background:linear-gradient(145deg,rgba(4,10,16,.98),rgba(8,22,28,.98));border:1px solid rgba(88,213,232,.45);border-radius:18px;box-shadow:0 30px 100px rgba(0,0,0,.65);color:#e8f7fa;font:13px/1.45 Inter,system-ui,sans-serif}.gem-investor-center.is-open{display:block}',
   '.gem-investor-head{display:flex;justify-content:space-between;gap:20px}.gem-investor-head span,.gem-investor-section{color:#58d5e8;font:700 10px ui-monospace,monospace;letter-spacing:.16em}.gem-investor-head h2{max-width:780px;margin:8px 0;font-size:30px;line-height:1.05}.gem-investor-head p{max-width:760px;color:#9db5bc;font-size:15px}.gem-investor-head>button{height:32px;background:none;border:0;color:#9db5bc;font-size:28px;cursor:pointer}',
   '.gem-investor-why{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}.gem-investor-why>div{padding:16px;border:1px solid rgba(130,180,190,.18);border-radius:10px;background:rgba(255,255,255,.025)}.gem-investor-why b{color:#58d5e8;font:700 11px ui-monospace,monospace}.gem-investor-why strong{display:block;margin:8px 0}.gem-investor-why small{color:#8fa7ae}',
   '.gem-investor-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:10px}.gem-investor-scenario{padding:18px;text-align:left;color:#dcecf0;background:rgba(255,255,255,.025);border:1px solid rgba(130,180,190,.2);border-radius:10px;cursor:pointer}.gem-investor-scenario:hover,.gem-investor-scenario.is-selected{border-color:#58d5e8;background:rgba(88,213,232,.08)}.gem-investor-scenario b,.gem-investor-scenario span,.gem-investor-scenario small{display:block}.gem-investor-scenario b{font:700 10px ui-monospace,monospace;color:#58d5e8}.gem-investor-scenario span{margin:10px 0;font-size:22px;font-weight:700}.gem-investor-scenario small{color:#829aa2}.gem-investor-breakdown{margin-top:12px;padding:14px;border-top:1px solid rgba(130,180,190,.18);color:#a9bdc2}.gem-investor-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:22px}.gem-investor-footer span{font-size:8px;color:#667f87}.gem-investor-footer button{padding:11px 16px;border:1px solid #58d5e8;border-radius:7px;background:#58d5e8;color:#041016;font-weight:800;cursor:pointer}@media(max-width:900px){.gem-investor-center{inset:4vh 3vw;padding:18px}.gem-investor-why,.gem-investor-cards{grid-template-columns:1fr}.gem-investor-head h2{font-size:23px}.gem-investor-footer{align-items:flex-start;flex-direction:column}}'
  ].join('');document.head.append(style);document.body.append(panel);
  const breakdown=(key)=>{
   const s=SCENARIOS[key],c=calc(s);panel.querySelectorAll('.gem-investor-scenario').forEach(x=>x.classList.toggle('is-selected',x.dataset.scenario===key));
   panel.querySelector('[data-breakdown]').innerHTML='<b>'+s.label+'</b> · modeled annual revenue: <strong>'+money(c.annual)+'</strong> · subscription: '+money((c.intelligence+c.enterprise)*12)+' · transaction layer: '+money(c.transaction*12);
  };
  panel.querySelectorAll('.gem-investor-scenario').forEach(b=>b.addEventListener('click',()=>breakdown(b.dataset.scenario)));
  panel.querySelector('[data-close]').addEventListener('click',()=>panel.classList.remove('is-open'));
  panel.querySelector('[data-invest]').addEventListener('click',()=>document.dispatchEvent(new CustomEvent('gem:investor-brief-requested')));
  breakdown('BASE');
  document.addEventListener('gem:open-investor',()=>panel.classList.add('is-open'));
 };
 if(document.body)install();else document.addEventListener('DOMContentLoaded',install,{once:true});
}


export function buildInvestorRoomPanelMarkup(snapshot) {
  const base=snapshot?.scenarios?.BASE;
  const last=base?.years?.at(-1);
  const fmt=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(v||0));
  const pct=v=>((Number(v||0))*100).toFixed(1)+'%';
  const scenarios=['CONSERVATIVE','BASE','UPSIDE'];
  return '<section class="gem-investor-room" data-gem-investor-room>'+
    '<div class="gem-investor-room__hero"><span class="gem-investor-room__eyebrow">PUBLIC MARKETS • INVESTOR ROOM</span><h2>Build the operating system for global minerals.</h2><p>From planetary intelligence to assets, capital, trade and settlement — one scalable operating layer.</p></div>'+
    '<div class="gem-investor-room__metrics"><article><small>BASE • YEAR 5 REVENUE</small><strong>'+fmt(last?.revenue)+'</strong></article><article><small>YEAR 5 EBITDA MODEL</small><strong>'+fmt(last?.ebitda)+'</strong></article><article><small>5-YEAR MODEL</small><strong>3 SCENARIOS</strong></article><article><small>IPO PATH</small><strong>6 STAGES</strong></article></div>'+
    '<div class="gem-investor-room__section"><h3>Revenue scenarios</h3><div class="gem-investor-room__cards">'+scenarios.map(s=>{const x=snapshot.scenarios[s], y=x.years.at(-1);return '<article><span>'+s+'</span><strong>'+fmt(y.revenue)+'</strong><small>YEAR 5 • '+fmt(y.ebitda)+' EBITDA</small></article>';}).join('')+'</div></div>'+
    '<div class="gem-investor-room__section"><h3>Illustrative investor economics</h3><div class="gem-investor-room__split"><div><small>RAISE</small><strong>'+fmt(snapshot.dilution?.raiseAmount)+'</strong></div><div><small>POST-MONEY</small><strong>'+fmt(snapshot.dilution?.postMoneyValuation)+'</strong></div><div><small>NEW INVESTOR OWNERSHIP</small><strong>'+pct(snapshot.dilution?.newInvestorOwnership)+'</strong></div></div></div>'+
    '<div class="gem-investor-room__section"><h3>Use of funds</h3><div class="gem-investor-room__funds">'+Object.entries(snapshot.useOfFunds?.allocation||{}).map(([k,v])=>'<div><span>'+k.replaceAll('_',' ').toUpperCase()+'</span><b>'+Math.round(v.percent*100)+'%</b><small>'+fmt(v.amount)+'</small></div>').join('')+'</div></div>'+
    '<div class="gem-investor-room__section"><h3>Path to public markets</h3><div class="gem-investor-room__path">'+(snapshot.ipoPath||[]).map(x=>'<div class="gem-investor-room__stage '+x.status.toLowerCase()+'"><b>'+x.order+'</b><span>'+x.stage+'</span><small>'+x.description+'</small></div>').join('')+'</div></div>'+
    '<div class="gem-investor-room__disclaimer">'+snapshot.disclaimer+'</div>'+
    '</section>';
}
