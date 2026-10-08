/**
 * GEM Web Experience
 *
 * Unique GEM planetary intelligence product shell:
 * fast search, entity discovery, progressive disclosure and responsive
 * navigation. It sits above the existing geospatial engine rather than
 * replacing it.
 */

const NAV = [
  ['home', 'Home'],
  ['explore', 'Explore'],
  ['targets', 'Targets'],
  ['assets', 'Assets'],
  ['companies', 'Companies'],
  ['markets', 'Markets'],
  ['intelligence', 'Intelligence'],
  ['investor', 'Investor'],
];

function node(tag, className, text = '') {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function emit(name, detail = {}) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

function installStyles() {
  if (document.getElementById('gem-web-experience-style')) return;
  const style = document.createElement('style');
  style.id = 'gem-web-experience-style';
  style.textContent = `
    :root{--gem-cyan:#68e8f4;--gem-blue:#4f7cff;--gem-violet:#9b7cff;--gem-white:#f4fbff;--gem-dim:#7c929d;--gem-panel:rgba(5,10,17,.72);--gem-line:rgba(150,205,220,.16)}
    body.gem-web-product{overflow:hidden;background:#02060a}
    .gem-web-header{position:fixed;z-index:15000;top:14px;left:18px;right:18px;height:58px;display:flex;align-items:center;gap:18px;padding:0 13px 0 15px;border:1px solid var(--gem-line);border-radius:17px;background:linear-gradient(110deg,rgba(5,12,19,.92),rgba(5,10,17,.68));backdrop-filter:blur(24px);box-shadow:0 14px 50px rgba(0,0,0,.34);font-family:Inter,system-ui,sans-serif}
    .gem-web-logo{display:flex;align-items:center;gap:10px;min-width:205px;color:var(--gem-white);letter-spacing:-.03em}.gem-web-logo-mark{position:relative;width:35px;height:35px;border-radius:11px;display:grid;place-items:center;background:#07131b;border:1px solid rgba(104,232,244,.48);color:var(--gem-cyan);font-weight:900;box-shadow:inset 0 0 22px rgba(104,232,244,.08)}.gem-web-logo-mark:after{content:"";position:absolute;inset:5px;border:1px solid rgba(155,124,255,.4);border-radius:8px;transform:rotate(45deg)}.gem-web-logo strong{display:block;font-size:15px}.gem-web-logo small{display:block;color:var(--gem-dim);font-size:7px;letter-spacing:.2em;margin-top:2px}
    .gem-web-search{height:38px;flex:1;max-width:610px;display:flex;align-items:center;gap:9px;padding:0 12px;border:1px solid var(--gem-line);border-radius:11px;background:rgba(255,255,255,.035);color:var(--gem-dim)}.gem-web-search input{flex:1;border:0;outline:0;background:transparent;color:var(--gem-white);font-size:12px}.gem-web-search:focus-within{border-color:rgba(104,232,244,.48);box-shadow:0 0 0 3px rgba(104,232,244,.05)}.gem-web-search kbd{border:1px solid var(--gem-line);border-radius:5px;padding:3px 6px;font-size:8px}
    .gem-web-nav{display:flex;align-items:center;gap:2px;margin-left:auto}.gem-web-nav button{border:0;background:transparent;color:#81959e;padding:8px 9px;border-radius:8px;cursor:pointer;font-size:9px;letter-spacing:.04em}.gem-web-nav button:hover{color:var(--gem-white);background:rgba(104,232,244,.05)}.gem-web-nav button.is-active{color:var(--gem-cyan);background:rgba(104,232,244,.07);box-shadow:inset 0 -1px var(--gem-cyan)}
    .gem-web-user{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(145deg,#17243a,#0d141f);border:1px solid var(--gem-line);color:var(--gem-white);font-size:10px;font-weight:800}
    .gem-web-main{position:fixed;z-index:12000;inset:0;padding:105px 28px 28px;pointer-events:none;font-family:Inter,system-ui,sans-serif;background:radial-gradient(ellipse at 54% 48%,rgba(38,103,125,.08),transparent 42%)}
    .gem-web-main:before{content:"";position:absolute;inset:68px 0 0;background-image:linear-gradient(rgba(104,232,244,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(104,232,244,.025) 1px,transparent 1px);background-size:48px 48px;mask-image:radial-gradient(circle at center,black,transparent 70%);pointer-events:none}
    .gem-web-hero{position:relative;pointer-events:auto;max-width:780px;margin:8vh auto 0;text-align:center}.gem-web-kicker{color:var(--gem-cyan);font-size:8px;font-weight:800;letter-spacing:.3em}.gem-web-hero h1{margin:15px 0 10px;color:var(--gem-white);font-size:clamp(36px,5vw,70px);line-height:.98;letter-spacing:-.065em;text-shadow:0 0 45px rgba(104,232,244,.09)}.gem-web-hero h1 em{font-style:normal;background:linear-gradient(90deg,var(--gem-cyan),#fff,var(--gem-violet));background-clip:text;color:transparent}.gem-web-hero p{margin:auto;color:#849aa5;font-size:12px;line-height:1.6;max-width:590px}
    .gem-web-stats{display:flex;justify-content:center;gap:7px;margin-top:22px}.gem-web-stat{min-width:110px;padding:10px 13px;border:1px solid var(--gem-line);border-radius:10px;background:rgba(5,11,17,.58);backdrop-filter:blur(12px)}.gem-web-stat strong{display:block;color:var(--gem-white);font-size:15px}.gem-web-stat span{color:var(--gem-dim);font-size:7px;text-transform:uppercase;letter-spacing:.14em}
    .gem-web-card-row{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:center;gap:9px;pointer-events:auto}.gem-web-card{width:min(29vw,315px);padding:15px;border:1px solid var(--gem-line);border-radius:14px;background:linear-gradient(145deg,rgba(8,16,24,.84),rgba(4,9,15,.64));backdrop-filter:blur(18px);box-shadow:0 20px 60px rgba(0,0,0,.3);transition:transform .2s,border-color .2s}.gem-web-card:hover{transform:translateY(-4px);border-color:rgba(104,232,244,.35)}.gem-web-card-head{display:flex;justify-content:space-between;color:#657b85;font-size:7px;text-transform:uppercase;letter-spacing:.15em}.gem-web-card h3{margin:9px 0 4px;color:var(--gem-white);font-size:14px}.gem-web-card p{margin:0;color:#718792;font-size:9px;line-height:1.5}.gem-web-card button{margin-top:12px;border:0;background:transparent;color:var(--gem-cyan);padding:0;font-size:8px;font-weight:800;letter-spacing:.12em;cursor:pointer}
    .gem-web-results{position:fixed;z-index:16000;top:82px;left:50%;transform:translateX(-50%);width:min(690px,calc(100vw - 32px));display:none;border:1px solid var(--gem-line);border-radius:14px;background:rgba(4,9,15,.97);backdrop-filter:blur(24px);box-shadow:0 30px 90px rgba(0,0,0,.65);overflow:hidden}.gem-web-results.is-open{display:block}.gem-web-result{padding:12px 15px;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer}.gem-web-result:hover{background:rgba(104,232,244,.05)}.gem-web-result b{color:var(--gem-white);font-size:11px}.gem-web-result span{display:block;color:var(--gem-dim);font-size:8px;margin-top:3px}
    .gem-web-mobile{display:none}
    @media(max-width:1120px){.gem-web-nav button{padding:8px 5px;font-size:8px}.gem-web-logo{min-width:165px}}@media(max-width:850px){.gem-web-nav{display:none}.gem-web-logo{min-width:auto}.gem-web-search{max-width:none}.gem-web-card{width:31vw}}@media(max-width:650px){.gem-web-header{top:8px;left:8px;right:8px;height:54px}.gem-web-logo-text{display:none}.gem-web-search{position:absolute;top:62px;left:0;right:0}.gem-web-main{padding:94px 10px 10px}.gem-web-hero{margin-top:8vh}.gem-web-hero h1{font-size:38px}.gem-web-stats{overflow:auto;justify-content:flex-start}.gem-web-card-row{justify-content:flex-start;overflow:auto;padding:0 2px 3px}.gem-web-card{min-width:260px}.gem-web-mobile{display:grid;position:fixed;z-index:15001;right:10px;bottom:10px;width:43px;height:43px;border:1px solid var(--gem-line);border-radius:50%;background:#071019;color:var(--gem-cyan);place-items:center}}
  `;
  document.head.append(style);
}
function openExplore() {
  document.querySelector('.gem-explore-overlay')?.remove();
  const overlay=node('section','gem-explore-overlay');
  overlay.innerHTML=`
    <div class="gem-explore-backdrop"></div>
    <div class="gem-explore-panel">
      <div class="gem-explore-top"><div><span>GEM DISCOVERY FABRIC</span><h2>Explore the mineral planet</h2><p>Navigate from commodity to country, resource, target, company and asset without leaving the intelligence layer.</p></div><button data-close>×</button></div>
      <div class="gem-explore-command">
        <span>⌕</span><input data-explore-query placeholder="Search gold, copper, Colombia, target, company..." autocomplete="off">
        <div class="gem-explore-filters"><button class="is-active" data-filter="all">ALL</button><button data-filter="commodity">COMMODITIES</button><button data-filter="country">COUNTRIES</button><button data-filter="target">TARGETS</button><button data-filter="asset">ASSETS</button><button data-filter="company">COMPANIES</button></div>
      </div>
      <div class="gem-explore-grid">
        <article class="gem-discovery-card gem-discovery-feature"><span>PLANETARY ATLAS</span><strong>Global Resource Atlas</strong><p>Minerals · metals · petroleum · gas · depth · evidence</p><button data-action="resource">OPEN ATLAS →</button></article>
        <article class="gem-discovery-card"><span>MINERAL SYSTEMS</span><strong>Target Intelligence</strong><p>Evidence convergence and next-best exploration actions.</p><button data-action="target">DISCOVER TARGETS →</button></article>
        <article class="gem-discovery-card"><span>NETWORK</span><strong>Mining Participants</strong><p>Miners · operators · traders · producers · off-takers.</p><button data-action="company">OPEN NETWORK →</button></article>
        <article class="gem-discovery-card"><span>PHYSICAL WORLD</span><strong>Asset Intelligence</strong><p>Digital twins, custody, trade, finance and settlement links.</p><button data-action="asset">OPEN ASSETS →</button></article>
        <article class="gem-discovery-card"><span>MARKET</span><strong>Commodity Intelligence</strong><p>Supply, processing, demand, capital and strategic exposure.</p><button data-action="market">OPEN MARKETS →</button></article>
        <article class="gem-discovery-card"><span>COUNTRY</span><strong>Mineral Security</strong><p>Geology, production, trade, refining and strategic dependency.</p><button data-action="country">COUNTRY INTELLIGENCE →</button></article>
      </div>
      <div class="gem-explore-results" data-explore-results><div class="gem-explore-empty">Begin with a mineral, location, company or GEM target.</div></div>
    </div>`;
  document.body.append(overlay);
  const query=overlay.querySelector('[data-explore-query]');
  const results=overlay.querySelector('[data-explore-results]');
  const render=()=>{
    const q=query.value.trim().toLowerCase();
    if(!q){results.innerHTML='<div class="gem-explore-empty">Begin with a mineral, location, company or GEM target.</div>';return;}
    const data=[
      ['GOLD','COMMODITY','Global mineral intelligence · supply · targets'],
      ['COPPER','COMMODITY','Geology · geochemistry · supply chain'],
      ['LITHIUM','COMMODITY','Critical mineral · projects · capital'],
      ['COLOMBIA','COUNTRY','National mineral security · geology · projects'],
      ['BOLIVIA','COUNTRY','Strategic minerals · tungsten · lithium'],
      ['GEM TARGETS','TARGET','Global prospectivity · evidence · decision'],
      ['RESOURCE ATLAS','RESOURCE','Depth-resolved global resource data'],
      ['MINING PARTICIPANTS','COMPANY','Miners · operators · traders · off-takers'],
      ['ASSET REGISTRY','ASSET','Physical assets · digital twins · custody']
    ].filter(x=>(x[0]+' '+x[1]+' '+x[2]).toLowerCase().includes(q));
    results.innerHTML=data.length?data.map(x=>'<button class="gem-explore-result"><b>'+x[0]+'</b><span>'+x[1]+' · '+x[2]+'</span><i>›</i></button>').join(''):'<div class="gem-explore-empty">No indexed entity matches this query yet.</div>';
    results.querySelectorAll('button').forEach((b,i)=>b.addEventListener('click',()=>{const x=data[i];emit('gem:web-search',{query:query.value,name:x[0],type:x[1]});}));
  };
  query.addEventListener('input',render);
  overlay.querySelector('[data-close]').addEventListener('click',()=>overlay.remove());
  overlay.querySelector('.gem-explore-backdrop').addEventListener('click',()=>overlay.remove());
  overlay.querySelectorAll('.gem-explore-filters button').forEach(b=>b.addEventListener('click',()=>{overlay.querySelectorAll('.gem-explore-filters button').forEach(x=>x.classList.remove('is-active'));b.classList.add('is-active');}));
  overlay.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>{
    const a=b.dataset.action;
    if(a==='target')emit('gem:open-targets');
    if(a==='asset')emit('gem:open-asset-registry');
    if(a==='market')emit('gem:open-asset-exchange');
    if(a==='resource')emit('gem:web-section',{section:'resources'});
    if(a==='company')emit('gem:web-section',{section:'companies'});
    if(a==='country')emit('gem:web-section',{section:'country'});
  }));
  requestAnimationFrame(()=>query.focus());
}

function installExploreStyles() {
  if(document.getElementById('gem-explore-style'))return;
  const style=document.createElement('style');style.id='gem-explore-style';style.textContent=`
    .gem-explore-overlay{position:fixed;inset:0;z-index:17000;font-family:Inter,system-ui,sans-serif;color:#eefaff}.gem-explore-backdrop{position:absolute;inset:0;background:rgba(1,5,9,.72);backdrop-filter:blur(16px)}.gem-explore-panel{position:absolute;inset:8vh 7vw;background:linear-gradient(145deg,rgba(7,15,24,.97),rgba(3,8,14,.96));border:1px solid rgba(104,232,244,.18);border-radius:24px;box-shadow:0 40px 140px rgba(0,0,0,.7);padding:34px;overflow:auto}.gem-explore-top{display:flex;justify-content:space-between;gap:20px}.gem-explore-top>div>span{color:#68e8f4;font:800 8px ui-monospace,monospace;letter-spacing:.25em}.gem-explore-top h2{font-size:32px;letter-spacing:-.04em;margin:8px 0}.gem-explore-top p{color:#7d949e;font-size:11px;max-width:650px}.gem-explore-top>button{width:38px;height:38px;border:1px solid rgba(150,205,220,.16);border-radius:50%;background:transparent;color:#9bb0b8;font-size:23px;cursor:pointer}.gem-explore-command{margin:25px 0 16px;padding:13px;border:1px solid rgba(104,232,244,.18);border-radius:14px;background:rgba(255,255,255,.025)}.gem-explore-command>span{color:#68e8f4}.gem-explore-command input{width:calc(100% - 30px);border:0;outline:0;background:transparent;color:#eefaff;font-size:14px}.gem-explore-filters{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.gem-explore-filters button{border:1px solid rgba(150,205,220,.13);border-radius:999px;background:transparent;color:#738a94;padding:6px 9px;font-size:7px;letter-spacing:.12em;cursor:pointer}.gem-explore-filters button.is-active,.gem-explore-filters button:hover{color:#68e8f4;border-color:rgba(104,232,244,.35);background:rgba(104,232,244,.05)}.gem-explore-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.gem-discovery-card{min-height:125px;padding:17px;border:1px solid rgba(150,205,220,.12);border-radius:15px;background:rgba(255,255,255,.025);transition:.2s}.gem-discovery-card:hover{transform:translateY(-3px);border-color:rgba(104,232,244,.3);background:rgba(104,232,244,.035)}.gem-discovery-card span{color:#647c86;font:700 7px ui-monospace,monospace;letter-spacing:.16em}.gem-discovery-card strong{display:block;margin-top:9px;font-size:14px}.gem-discovery-card p{color:#728a94;font-size:9px;line-height:1.5;max-width:280px}.gem-discovery-card button{border:0;background:none;color:#68e8f4;font-size:8px;font-weight:800;letter-spacing:.1em;cursor:pointer}.gem-discovery-feature{background:radial-gradient(circle at 80% 20%,rgba(104,232,244,.1),transparent 40%),rgba(255,255,255,.025)}.gem-explore-results{margin-top:13px;border-top:1px solid rgba(150,205,220,.09)}.gem-explore-result{width:100%;display:flex;align-items:center;gap:12px;padding:12px 4px;border:0;border-bottom:1px solid rgba(150,205,220,.08);background:transparent;color:#eafaff;text-align:left;cursor:pointer}.gem-explore-result:hover{background:rgba(104,232,244,.04)}.gem-explore-result b{min-width:125px}.gem-explore-result span{flex:1;color:#718993;font-size:9px}.gem-explore-result i{color:#68e8f4;font-style:normal;font-size:18px}.gem-explore-empty{padding:25px 4px;color:#647b85;font-size:10px}@media(max-width:800px){.gem-explore-panel{inset:4vh 3vw;padding:20px}.gem-explore-grid{grid-template-columns:1fr 1fr}.gem-explore-top h2{font-size:25px}}@media(max-width:520px){.gem-explore-grid{grid-template-columns:1fr}.gem-explore-panel{border-radius:17px}}
  `;document.head.append(style);
}

function searchResults(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const base = [
    ['Gold · Global', 'Commodity intelligence · targets · supply chain'],
    ['Gold · Colombia', 'Country intelligence · geology · targets · projects'],
    ['GEM Targets', 'Global target discovery and prospectivity'],
    ['Global Resource Atlas', 'Depth-resolved minerals, metals, petroleum and gas'],
    ['Companies', 'Mining companies, operators, traders and off-takers'],
  ];
  return base.filter(([name, detail]) => (name + ' ' + detail).toLowerCase().includes(q) || q.length > 1);
}

function installSearch() {
  const input = document.querySelector('.gem-web-search input');
  const results = document.querySelector('.gem-web-results');
  if (!input || !results) return;
  const render = () => {
    results.innerHTML = '';
    searchResults(input.value).slice(0,6).forEach(([name, detail]) => {
      const row = node('div','gem-web-result');
      row.innerHTML = '<b></b><span></span>';
      row.querySelector('b').textContent = name;
      row.querySelector('span').textContent = detail;
      row.addEventListener('click',()=>{emit('gem:web-search',{query:input.value,name});results.classList.remove('is-open');});
      results.append(row);
    });
    results.classList.toggle('is-open',Boolean(input.value.trim()));
  };
  input.addEventListener('input',render);
  input.addEventListener('keydown',e=>{if(e.key==='Escape'){input.value='';results.classList.remove('is-open')}});
  document.addEventListener('click',e=>{if(!e.target.closest('.gem-web-search')&&!e.target.closest('.gem-web-results'))results.classList.remove('is-open')});
}

export function installGemWebExperience() {
  if (document.querySelector('.gem-web-header')) return;
  installStyles();
  installExploreStyles();
  document.body.classList.add('gem-web-product');

  const header = node('header','gem-web-header');
  header.innerHTML = `
    <div class="gem-web-logo"><span class="gem-web-logo-mark">G</span><div class="gem-web-logo-text"><strong>GEM</strong><small>GLOBAL MINERAL INTELLIGENCE</small></div></div>
    <label class="gem-web-search"><span>⌕</span><input aria-label="Search GEM" placeholder="Search minerals, targets, companies, projects..." autocomplete="off"><kbd>⌘ K</kbd></label>
    <nav class="gem-web-nav"></nav>
    <div class="gem-web-user" title="Gio">G</div>
  `;
  const nav = header.querySelector('.gem-web-nav');
  NAV.forEach(([id,label],index)=>{
    const button=node('button',index===0?'is-active':'',label);
    button.dataset.section=id;
    button.addEventListener('click',()=>{
      nav.querySelectorAll('button').forEach(x=>x.classList.remove('is-active'));
      button.classList.add('is-active');
      emit('gem:web-section',{section:id});
      if(id==='targets') emit('gem:open-targets');
      if(id==='assets') emit('gem:open-asset-registry');
      if(id==='markets') emit('gem:open-asset-exchange');
      if(id==='investor') emit('gem:open-investor');
      if(id==='explore') openExplore();
    });
    nav.append(button);
  });
  document.body.append(header);

  const main=node('main','gem-web-main');
  main.innerHTML=`
    <section class="gem-web-hero">
      <div class="gem-web-kicker">GLOBAL EXPLORATION & MINERAL INTELLIGENCE</div>
      <h1>Understand the planet.<br><em>Find what matters.</em></h1>
      <p>Planetary evidence, mineral systems, targets, assets, markets and capital in one operating platform.</p>
      <div class="gem-web-stats">
        <div class="gem-web-stat"><strong>GLOBAL</strong><span>Planetary coverage</span></div>
        <div class="gem-web-stat"><strong>24/7</strong><span>Data intelligence</span></div>
        <div class="gem-web-stat"><strong>4D</strong><span>Resource intelligence</span></div>
      </div>
    </section>
    <div class="gem-web-card-row">
      <article class="gem-web-card"><div class="gem-web-card-head"><span>Explore</span><span>01</span></div><h3>Global Resource Atlas</h3><p>Search minerals, metals, petroleum and gas by location, depth, evidence and source.</p><button data-open="resources">EXPLORE RESOURCES →</button></article>
      <article class="gem-web-card"><div class="gem-web-card-head"><span>Discover</span><span>02</span></div><h3>Target Intelligence</h3><p>Move from planetary evidence to ranked targets and explainable next-best actions.</p><button data-open="targets">FIND TARGETS →</button></article>
      <article class="gem-web-card"><div class="gem-web-card-head"><span>Operate</span><span>03</span></div><h3>Assets & Markets</h3><p>Connect projects, assets, counterparties, capital, trade, logistics and settlement.</p><button data-open="assets">OPEN OPERATING LAYER →</button></article>
    </div>
  `;
  document.body.append(main);

  const results=node('div','gem-web-results');
  document.body.append(results);
  const mobile=node('button','gem-web-mobile','☰');
  mobile.setAttribute('aria-label','Open GEM navigation');
  mobile.addEventListener('click',()=>header.classList.toggle('is-mobile-open'));
  document.body.append(mobile);

  main.querySelectorAll('[data-open]').forEach(button=>button.addEventListener('click',()=>{
    const action=button.dataset.open;
    if(action==='resources') openExplore();
    if(action==='targets') emit('gem:open-targets');
    if(action==='assets') emit('gem:open-asset-registry');
  }));

  installSearch();
  document.addEventListener('keydown',event=>{
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();document.querySelector('.gem-web-search input')?.focus();}
  });
}
