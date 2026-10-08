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
    if(action==='resources') emit('gem:web-section',{section:'explore'});
    if(action==='targets') emit('gem:open-targets');
    if(action==='assets') emit('gem:open-asset-registry');
  }));

  installSearch();
  document.addEventListener('keydown',event=>{
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();document.querySelector('.gem-web-search input')?.focus();}
  });
}
