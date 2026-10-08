/**
 * GEM Web Experience
 *
 * Product shell inspired by modern marketplace/professional-network UX:
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
    :root{--gem-accent:#56d7e9;--gem-ink:#eafcff;--gem-muted:#8198a1;--gem-surface:rgba(6,13,18,.88);--gem-border:rgba(143,210,220,.18)}
    body.gem-web-product{overflow:hidden}
    .gem-web-header{position:fixed;z-index:15000;left:0;right:0;top:0;height:68px;display:flex;align-items:center;gap:22px;padding:0 22px;background:rgba(4,10,14,.78);border-bottom:1px solid var(--gem-border);backdrop-filter:blur(20px);font-family:Inter,system-ui,sans-serif}
    .gem-web-logo{display:flex;align-items:center;gap:10px;min-width:172px;color:var(--gem-ink);font-weight:700;letter-spacing:-.02em}
    .gem-web-logo-mark{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(145deg,#75e5f2,#217c8a);color:#031015;font-weight:900}
    .gem-web-logo small{display:block;color:var(--gem-muted);font-size:8px;letter-spacing:.16em;margin-top:2px}
    .gem-web-search{height:40px;flex:1;max-width:620px;display:flex;align-items:center;gap:10px;padding:0 14px;border:1px solid var(--gem-border);border-radius:12px;background:rgba(255,255,255,.045);color:var(--gem-muted)}
    .gem-web-search input{flex:1;border:0;outline:0;background:transparent;color:var(--gem-ink);font-size:13px}
    .gem-web-search kbd{border:1px solid var(--gem-border);border-radius:5px;padding:3px 6px;font-size:9px}
    .gem-web-nav{display:flex;align-items:center;gap:2px;margin-left:auto}
    .gem-web-nav button,.gem-web-actions button{border:0;background:transparent;color:#9bb1b8;padding:9px 10px;border-radius:9px;cursor:pointer;font-size:11px}
    .gem-web-nav button:hover,.gem-web-nav button.is-active{background:rgba(86,215,233,.09);color:var(--gem-ink)}
    .gem-web-nav button.is-active{color:var(--gem-accent)}
    .gem-web-user{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#16252c;color:var(--gem-ink);font-size:11px;font-weight:700}
    .gem-web-main{position:fixed;z-index:12000;top:84px;left:22px;right:22px;bottom:22px;pointer-events:none;font-family:Inter,system-ui,sans-serif}
    .gem-web-hero{pointer-events:auto;max-width:700px}
    .gem-web-kicker{color:var(--gem-accent);font-size:9px;font-weight:800;letter-spacing:.16em}
    .gem-web-hero h1{margin:8px 0 4px;color:#f2fdff;font-size:29px;line-height:1.08;letter-spacing:-.04em}
    .gem-web-hero p{margin:0;color:#91a8b0;font-size:12px}
    .gem-web-stats{display:flex;gap:8px;margin-top:15px}
    .gem-web-stat{min-width:118px;padding:10px 12px;border:1px solid var(--gem-border);border-radius:10px;background:var(--gem-surface);backdrop-filter:blur(12px)}
    .gem-web-stat strong{display:block;color:var(--gem-ink);font-size:17px}.gem-web-stat span{color:var(--gem-muted);font-size:8px;text-transform:uppercase;letter-spacing:.09em}
    .gem-web-card-row{position:absolute;left:0;right:0;bottom:0;display:flex;gap:10px;pointer-events:auto}
    .gem-web-card{flex:1;min-width:0;max-width:330px;padding:14px;border:1px solid var(--gem-border);border-radius:13px;background:var(--gem-surface);backdrop-filter:blur(18px);box-shadow:0 18px 55px rgba(0,0,0,.25)}
    .gem-web-card-head{display:flex;justify-content:space-between;align-items:center;color:var(--gem-muted);font-size:9px;text-transform:uppercase;letter-spacing:.1em}
    .gem-web-card h3{margin:8px 0 3px;color:var(--gem-ink);font-size:14px}.gem-web-card p{margin:0;color:var(--gem-muted);font-size:10px;line-height:1.4}
    .gem-web-card button{margin-top:12px;border:1px solid rgba(86,215,233,.3);background:rgba(86,215,233,.08);color:var(--gem-accent);border-radius:8px;padding:8px 11px;font-size:9px;font-weight:800;cursor:pointer}
    .gem-web-results{position:fixed;z-index:16000;top:76px;left:50%;transform:translateX(-50%);width:min(700px,calc(100vw - 32px));display:none;border:1px solid var(--gem-border);border-radius:13px;background:rgba(5,11,15,.97);backdrop-filter:blur(20px);box-shadow:0 24px 80px rgba(0,0,0,.55);overflow:hidden}
    .gem-web-results.is-open{display:block}.gem-web-result{padding:13px 16px;border-bottom:1px solid rgba(255,255,255,.05);cursor:pointer}.gem-web-result:hover{background:rgba(86,215,233,.06)}
    .gem-web-result b{color:var(--gem-ink);font-size:12px}.gem-web-result span{display:block;color:var(--gem-muted);font-size:9px;margin-top:3px}
    .gem-web-mobile{display:none}
    @media(max-width:1100px){.gem-web-nav button{padding:8px 6px}.gem-web-nav button span{display:none}.gem-web-logo{min-width:135px}}
    @media(max-width:760px){.gem-web-header{height:60px;padding:0 10px;gap:8px}.gem-web-logo{min-width:auto}.gem-web-logo-text{display:none}.gem-web-search{order:3;position:absolute;left:10px;right:10px;top:66px;max-width:none}.gem-web-nav{display:none}.gem-web-main{top:76px;left:10px;right:10px;bottom:10px}.gem-web-hero h1{font-size:23px}.gem-web-stats{overflow:auto}.gem-web-card-row{overflow:auto;padding-bottom:2px}.gem-web-card{min-width:260px}.gem-web-mobile{display:grid;position:fixed;z-index:15001;right:10px;bottom:10px;width:46px;height:46px;border:1px solid var(--gem-border);border-radius:50%;background:rgba(5,11,15,.92);color:var(--gem-accent);place-items:center}}
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
      <h1>Understand the planet.<br>Find what matters.</h1>
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
