/**
 * GEM Web Experience
 * Product-first discovery shell for GEM.
 *
 * Design principle:
 * DISCOVER -> SEARCH -> OPEN WORKSPACE -> GO DEEP
 *
 * The geospatial command center remains underneath as the specialist workspace.
 * The product shell is intentionally light: one search, a few decisions, then
 * progressive disclosure into the intelligence modules already built.
 */

const MODULES = [
  { id: 'map', label: 'Planet Map', eyebrow: 'ORIENT', text: 'Navigate the living planetary surface and move from geography into intelligence.', meta: 'GLOBAL SURFACE', action: 'map' },
  { id: 'resources', label: 'Resource Atlas', eyebrow: 'EXPLORE', text: 'Minerals, metals, petroleum and gas with location, depth, evidence and provenance.', meta: '4D DATA FABRIC', action: 'resources' },
  { id: 'targets', label: 'Target Intelligence', eyebrow: 'DISCOVER', text: 'Find, rank and explain exploration targets from converging planetary evidence.', meta: 'AI + EVIDENCE', action: 'targets' },
  { id: 'assets', label: 'Asset Intelligence', eyebrow: 'OPERATE', text: 'Track physical assets, digital twins, custody, trade and settlement.', meta: 'DIGITAL TWIN', action: 'assets' },
  { id: 'companies', label: 'Global Companies', eyebrow: 'NETWORK', text: 'Connect miners, operators, traders, producers, refineries and off-takers.', meta: 'NETWORK GRAPH', action: 'companies' },
  { id: 'markets', label: 'Markets', eyebrow: 'TRADE', text: 'Commodity discovery, RFQ, matching, exchange and trade operations.', meta: 'COMMODITY LAYER', action: 'markets' },
  { id: 'intelligence', label: 'Mineral Intelligence', eyebrow: 'UNDERSTAND', text: 'Geology, geophysics, geochemistry, hyperspectral and mineral systems.', meta: 'PLANETARY EVIDENCE', action: 'intelligence' },
  { id: 'security', label: 'Mineral Security', eyebrow: 'STRATEGY', text: 'Country exposure, supply concentration, refining risk and resilience.', meta: 'NATIONAL INTELLIGENCE', action: 'security' },
  { id: 'investor', label: 'Investor Room', eyebrow: 'CAPITAL', text: 'Business model, scenarios, capital path and public-markets readiness.', meta: 'INVESTOR INTELLIGENCE', action: 'investor' },
  { id: 'reports', label: 'Reports', eyebrow: 'DELIVER', text: 'Turn intelligence into decision-ready reports, evidence packages and investor briefs.', meta: 'DECISION OUTPUT', action: 'reports' },
];

const SEARCH_INDEX = [
  ['GOLD', 'Commodity', 'Mineral intelligence, targets, supply and markets'],
  ['COPPER', 'Commodity', 'Geology, geochemistry, projects and supply chain'],
  ['LITHIUM', 'Commodity', 'Critical mineral, projects, capital and security'],
  ['TUNGSTEN', 'Commodity', 'Strategic mineral, deposits, processing and trade'],
  ['RARE EARTHS', 'Commodity', 'Critical minerals, refining and strategic exposure'],
  ['COLOMBIA', 'Country', 'Mineral security, resources, companies and projects'],
  ['BOLIVIA', 'Country', 'Strategic minerals, resources and exploration'],
  ['DUBAI', 'Market', 'Trading, capital, logistics, custody and counterparties'],
  ['GEM TARGETS', 'Targets', 'Global prospectivity and exploration decisions'],
  ['RESOURCE ATLAS', 'Resources', 'Depth-resolved global resource intelligence'],
  ['MINING PARTICIPANTS', 'Companies', 'Miners, operators, traders and off-takers'],
  ['ASSET REGISTRY', 'Assets', 'Physical assets, passports and digital twins'],
  ['MINERAL SECURITY', 'Strategy', 'Country-level supply and strategic dependency'],
];

function emit(name, detail = {}) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

function injectStyles() {
  if (document.getElementById('gem-product-v2-style')) return;

  const style = document.createElement('style');
  style.id = 'gem-product-v2-style';
  style.textContent = `
    :root{
      --gem-bg:#03070b;
      --gem-surface:rgba(9,16,24,.82);
      --gem-surface-2:rgba(13,22,31,.9);
      --gem-border:rgba(145,194,207,.14);
      --gem-border-strong:rgba(104,232,244,.34);
      --gem-text:#eefaff;
      --gem-muted:#78909b;
      --gem-soft:#a9bac1;
      --gem-cyan:#68e8f4;
      --gem-violet:#a58cff;
      --gem-green:#7de7bd;
    }

    body.gem-web-product{overflow:hidden;background:var(--gem-bg)}
    body.gem-web-product .gem-command-header,
    body.gem-web-product .gem-map-hud,
    body.gem-web-product .gem-sources-panel,
    body.gem-web-product .gem-target-panel,
    body.gem-web-product .gem-bottom-intelligence,
    body.gem-web-product .gem-module-dock,
    body.gem-web-product .gem-map-hud,
    body.gem-web-product .gem-map-search,
    body.gem-web-product .gem-map-modes,
    body.gem-web-product .gem-map-meta{
      display:none!important;
    }

    .gem-product-shell.gem-map-focus{display:none}
    .gem-map-focus-back{
      position:fixed;top:16px;left:16px;z-index:19000;
      border:1px solid rgba(104,232,244,.28);border-radius:10px;
      background:rgba(4,11,17,.9);backdrop-filter:blur(16px);
      color:#68e8f4;padding:9px 12px;font:800 8px ui-monospace,monospace;
      cursor:pointer;
    }

    .gem-product-shell{
      position:fixed;
      inset:0;
      z-index:14500;
      color:var(--gem-text);
      font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      background:
        radial-gradient(circle at 50% 24%,rgba(43,126,145,.12),transparent 31%),
        radial-gradient(circle at 76% 70%,rgba(116,78,181,.08),transparent 26%),
        linear-gradient(180deg,#03080d 0%,#02060a 100%);
      overflow:auto;
    }

    .gem-product-shell:before{
      content:"";
      position:fixed;
      inset:0;
      pointer-events:none;
      opacity:.32;
      background-image:
        linear-gradient(rgba(104,232,244,.026) 1px,transparent 1px),
        linear-gradient(90deg,rgba(104,232,244,.026) 1px,transparent 1px);
      background-size:64px 64px;
      mask-image:radial-gradient(circle at 50% 38%,black 0%,transparent 76%);
    }

    .gem-product-header{
      position:sticky;
      top:0;
      z-index:4;
      height:68px;
      display:grid;
      grid-template-columns:auto minmax(260px,560px) auto;
      align-items:center;
      gap:28px;
      padding:0 30px;
      border-bottom:1px solid rgba(145,194,207,.1);
      background:rgba(3,8,13,.78);
      backdrop-filter:blur(24px);
    }

    .gem-product-brand{
      display:flex;
      align-items:center;
      gap:11px;
      cursor:pointer;
      min-width:178px;
    }

    .gem-product-mark{
      width:34px;height:34px;border-radius:11px;
      display:grid;place-items:center;
      color:var(--gem-cyan);
      border:1px solid rgba(104,232,244,.46);
      background:linear-gradient(145deg,#0b1c27,#061017);
      box-shadow:0 0 35px rgba(104,232,244,.08);
      font-weight:900;
      position:relative;
    }

    .gem-product-mark:after{
      content:"";
      position:absolute;inset:6px;
      border:1px solid rgba(165,140,255,.42);
      border-radius:7px;
      transform:rotate(45deg);
    }

    .gem-product-brand strong{font-size:14px;letter-spacing:.02em}
    .gem-product-brand small{display:block;color:#627b86;font-size:6px;letter-spacing:.19em;margin-top:2px}

    .gem-universal-search{
      height:42px;
      display:flex;
      align-items:center;
      gap:10px;
      padding:0 13px;
      border:1px solid var(--gem-border);
      border-radius:13px;
      background:rgba(255,255,255,.035);
      box-shadow:inset 0 1px rgba(255,255,255,.025);
      transition:.2s;
    }

    .gem-universal-search:focus-within{
      border-color:var(--gem-border-strong);
      background:rgba(104,232,244,.035);
      box-shadow:0 0 0 4px rgba(104,232,244,.035);
    }

    .gem-universal-search .search-icon{color:var(--gem-cyan);font-size:17px}
    .gem-universal-search input{
      flex:1;min-width:0;border:0;outline:0;background:transparent;
      color:var(--gem-text);font-size:12px;
    }
    .gem-universal-search input::placeholder{color:#617780}
    .gem-search-key{
      color:#657b84;border:1px solid var(--gem-border);border-radius:6px;
      padding:3px 6px;font:8px ui-monospace,monospace;
    }

    .gem-product-header-actions{display:flex;align-items:center;justify-content:flex-end;gap:7px}
    .gem-product-header-actions button{
      border:1px solid transparent;background:transparent;color:#8398a0;
      border-radius:9px;padding:8px 10px;cursor:pointer;font-size:9px;
    }
    .gem-product-header-actions button:hover{
      color:var(--gem-text);background:rgba(255,255,255,.035);
      border-color:var(--gem-border);
    }
    .gem-product-profile{
      display:flex!important;align-items:center;gap:7px;color:var(--gem-text)!important;
    }
    .gem-avatar{
      width:26px;height:26px;border-radius:9px;display:grid;place-items:center;
      background:linear-gradient(145deg,#18283a,#0b131d);border:1px solid var(--gem-border);
      color:var(--gem-cyan);font-weight:800;
    }

    .gem-product-content{
      position:relative;
      z-index:1;
      width:min(1180px,calc(100% - 48px));
      margin:0 auto;
      padding:54px 0 70px;
    }

    .gem-product-hero{
      max-width:900px;
      margin:0 auto;
      text-align:center;
      padding:40px 0 30px;
    }

    .gem-product-eyebrow{
      color:var(--gem-cyan);
      font:800 8px ui-monospace,monospace;
      letter-spacing:.28em;
    }

    .gem-product-hero h1{
      margin:15px 0 14px;
      font-size:clamp(42px,6vw,74px);
      line-height:.98;
      letter-spacing:-.067em;
      font-weight:720;
    }

    .gem-product-hero h1 em{
      font-style:normal;
      background:linear-gradient(90deg,var(--gem-cyan),#e9fcff 48%,var(--gem-violet));
      background-clip:text;color:transparent;
    }

    .gem-product-hero p{
      max-width:630px;margin:0 auto;color:var(--gem-muted);
      font-size:13px;line-height:1.7;
    }

    .gem-hero-search{
      width:min(760px,100%);
      height:62px;
      margin:28px auto 14px;
      display:flex;align-items:center;gap:13px;
      padding:0 18px;
      border:1px solid rgba(104,232,244,.24);
      border-radius:18px;
      background:rgba(8,17,25,.86);
      box-shadow:0 20px 70px rgba(0,0,0,.3),0 0 50px rgba(104,232,244,.035);
    }
    .gem-hero-search span{color:var(--gem-cyan);font-size:21px}
    .gem-hero-search input{
      flex:1;border:0;outline:0;background:transparent;color:var(--gem-text);
      font-size:15px;
    }
    .gem-hero-search input::placeholder{color:#60757e}
    .gem-hero-search button{
      border:0;border-radius:9px;background:#dffcff;color:#061117;
      padding:9px 13px;font-size:8px;font-weight:900;letter-spacing:.1em;cursor:pointer;
    }

    .gem-quick-links{
      display:flex;justify-content:center;gap:7px;flex-wrap:wrap;
    }
    .gem-quick-links button{
      border:1px solid var(--gem-border);border-radius:999px;
      background:rgba(255,255,255,.02);color:#80959d;
      padding:7px 11px;font-size:8px;cursor:pointer;
    }
    .gem-quick-links button:hover{color:var(--gem-cyan);border-color:var(--gem-border-strong)}

    .gem-section-heading{
      display:flex;align-items:end;justify-content:space-between;
      margin:36px 0 12px;
    }
    .gem-section-heading div span{
      color:#5f7882;font:800 7px ui-monospace,monospace;letter-spacing:.18em;
    }
    .gem-section-heading h2{
      margin:5px 0 0;font-size:20px;letter-spacing:-.035em;
    }
    .gem-section-heading button{
      border:0;background:transparent;color:var(--gem-cyan);
      font-size:8px;font-weight:800;cursor:pointer;
    }

    .gem-module-grid{
      display:grid;
      grid-template-columns:repeat(4,1fr);
      gap:9px;
    }

    .gem-module-card{
      position:relative;
      min-height:165px;
      display:flex;flex-direction:column;justify-content:space-between;
      padding:17px;
      border:1px solid var(--gem-border);
      border-radius:16px;
      background:
        radial-gradient(circle at 100% 0%,rgba(104,232,244,.05),transparent 38%),
        rgba(8,15,22,.78);
      cursor:pointer;
      transition:transform .2s,border-color .2s,background .2s;
    }
    .gem-module-card:hover{
      transform:translateY(-3px);
      border-color:rgba(104,232,244,.28);
      background:
        radial-gradient(circle at 100% 0%,rgba(104,232,244,.09),transparent 40%),
        rgba(11,22,30,.9);
    }
    .gem-module-card:nth-child(3n){background:
      radial-gradient(circle at 100% 0%,rgba(165,140,255,.07),transparent 38%),
      rgba(8,15,22,.78)}
    .gem-module-card .module-eyebrow{
      color:#617983;font:800 7px ui-monospace,monospace;letter-spacing:.17em;
    }
    .gem-module-card .module-arrow{
      position:absolute;right:16px;top:15px;color:#516a74;font-size:18px;
    }
    .gem-module-card strong{display:block;margin:13px 0 7px;font-size:15px;letter-spacing:-.025em}
    .gem-module-card p{margin:0;color:#718892;font-size:9px;line-height:1.55}
    .gem-module-card footer{display:flex;align-items:center;justify-content:space-between;margin-top:15px}
    .gem-module-card footer span{color:#536b75;font:7px ui-monospace,monospace;letter-spacing:.1em}
    .gem-module-card footer b{color:var(--gem-cyan);font-size:8px}

    .gem-lower-grid{
      display:grid;grid-template-columns:1.35fr .65fr;gap:10px;margin-top:10px;
    }
    .gem-feature-panel,.gem-status-panel{
      min-height:190px;padding:19px;border:1px solid var(--gem-border);
      border-radius:16px;background:rgba(8,15,22,.72);
    }
    .gem-feature-panel{position:relative;overflow:hidden}
    .gem-feature-panel:after{
      content:"";position:absolute;width:260px;height:260px;right:-90px;bottom:-150px;
      border-radius:50%;border:1px solid rgba(104,232,244,.14);
      box-shadow:0 0 0 28px rgba(104,232,244,.025),0 0 0 58px rgba(104,232,244,.018);
    }
    .gem-panel-label{color:#607984;font:800 7px ui-monospace,monospace;letter-spacing:.17em}
    .gem-feature-panel h3{margin:10px 0 5px;font-size:19px}
    .gem-feature-panel p{max-width:590px;color:#718993;font-size:9px;line-height:1.6}
    .gem-feature-actions{display:flex;gap:7px;margin-top:17px}
    .gem-feature-actions button{
      border:1px solid var(--gem-border);border-radius:8px;background:rgba(255,255,255,.025);
      color:#c6d8dd;padding:8px 11px;font-size:8px;cursor:pointer;
    }
    .gem-feature-actions button.primary{border-color:rgba(104,232,244,.3);background:rgba(104,232,244,.08);color:var(--gem-cyan)}
    .gem-status-list{display:grid;gap:8px;margin-top:13px}
    .gem-status-item{display:flex;align-items:center;justify-content:space-between;font-size:9px}
    .gem-status-item span{color:#718993}.gem-status-item b{color:var(--gem-green);font-size:8px}

    .gem-search-popover{
      position:fixed;z-index:18000;top:73px;left:50%;
      transform:translateX(-50%);
      width:min(760px,calc(100vw - 28px));
      max-height:70vh;overflow:auto;
      display:none;padding:8px;
      border:1px solid rgba(104,232,244,.2);border-radius:15px;
      background:rgba(4,10,16,.98);box-shadow:0 30px 100px rgba(0,0,0,.7);
      backdrop-filter:blur(24px);
    }
    .gem-search-popover.is-open{display:block}
    .gem-search-result{
      width:100%;display:grid;grid-template-columns:90px 1fr auto;gap:12px;
      align-items:center;text-align:left;border:0;border-radius:10px;background:transparent;
      padding:12px;cursor:pointer;color:var(--gem-text);
    }
    .gem-search-result:hover{background:rgba(104,232,244,.055)}
    .gem-search-result b{font:800 8px ui-monospace,monospace;color:var(--gem-cyan);letter-spacing:.12em}
    .gem-search-result strong{font-size:11px}.gem-search-result span{display:block;color:#687f88;font-size:8px;margin-top:3px}
    .gem-search-result i{color:var(--gem-cyan);font-style:normal;font-size:18px}
    .gem-search-empty{padding:18px;color:#617780;font-size:9px}

    .gem-workspace{
      position:fixed;inset:0;z-index:17500;
      display:none;overflow:auto;
      background:
        radial-gradient(circle at 80% 15%,rgba(104,232,244,.07),transparent 30%),
        linear-gradient(180deg,#03080d,#02060a);
      font-family:Inter,ui-sans-serif,system-ui,sans-serif;
    }
    .gem-workspace.is-open{display:block}
    .gem-workspace-header{
      position:sticky;top:0;z-index:2;height:70px;
      display:flex;align-items:center;gap:16px;padding:0 28px;
      border-bottom:1px solid var(--gem-border);
      background:rgba(3,8,13,.82);backdrop-filter:blur(20px);
    }
    .gem-back{border:1px solid var(--gem-border);background:transparent;color:#8ba0a8;border-radius:9px;padding:8px 10px;cursor:pointer}
    .gem-workspace-header span{color:#617983;font:800 7px ui-monospace,monospace;letter-spacing:.16em}
    .gem-workspace-header h2{margin:4px 0 0;font-size:18px}
    .gem-workspace-body{width:min(1180px,calc(100% - 48px));margin:auto;padding:38px 0 70px}
    .gem-workspace-command{
      display:flex;gap:8px;flex-wrap:wrap;margin:20px 0;
    }
    .gem-workspace-command input{
      flex:1;min-width:220px;height:44px;border:1px solid var(--gem-border);border-radius:11px;
      outline:0;background:rgba(255,255,255,.025);color:var(--gem-text);padding:0 13px;
    }
    .gem-workspace-command button{
      height:44px;border:1px solid var(--gem-border);border-radius:11px;background:rgba(255,255,255,.025);
      color:#9bb0b8;padding:0 14px;font-size:8px;font-weight:800;cursor:pointer;
    }
    .gem-workspace-command button:hover{border-color:var(--gem-border-strong);color:var(--gem-cyan)}
    .gem-workspace-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
    .gem-work-card{padding:20px;border:1px solid var(--gem-border);border-radius:15px;background:rgba(255,255,255,.025);min-height:150px}
    .gem-work-card span{color:#617983;font:800 7px ui-monospace,monospace;letter-spacing:.14em}
    .gem-work-card strong{display:block;font-size:15px;margin:10px 0 6px}
    .gem-work-card p{color:#718993;font-size:9px;line-height:1.55;margin:0}
    .gem-work-card button{margin-top:18px;border:0;background:none;color:var(--gem-cyan);font-size:8px;font-weight:800;cursor:pointer}
    .gem-work-note{margin-top:12px;padding:14px;border:1px dashed rgba(104,232,244,.16);border-radius:12px;color:#647b84;font-size:9px;line-height:1.6}

    @media(max-width:950px){
      .gem-product-header{grid-template-columns:auto 1fr auto;gap:12px;padding:0 15px}
      .gem-product-header-actions button[data-nav]{display:none}
      .gem-module-grid{grid-template-columns:repeat(2,1fr)}
      .gem-lower-grid{grid-template-columns:1fr}
    }
    @media(max-width:600px){
      .gem-product-header{height:60px}
      .gem-product-brand{min-width:0}.gem-product-brand div{display:none}
      .gem-product-header-actions .gem-language{display:none}
      .gem-product-content{width:min(100% - 24px,1180px);padding-top:34px}
      .gem-product-hero{padding-top:25px}
      .gem-product-hero h1{font-size:43px}
      .gem-hero-search{height:56px}
      .gem-search-key{display:none}
      .gem-module-grid{grid-template-columns:1fr}
      .gem-workspace-grid{grid-template-columns:1fr}
      .gem-workspace-body{width:calc(100% - 24px)}
      .gem-workspace-header{padding:0 12px}
    }
  `;
  document.head.append(style);
}

function installSearchPopover() {
  if (document.querySelector('.gem-search-popover')) return;
  const popover = document.createElement('div');
  popover.className = 'gem-search-popover';
  document.body.append(popover);
  return popover;
}

function searchMatches(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SEARCH_INDEX
    .filter(([name, type, description]) =>
      (name + ' ' + type + ' ' + description).toLowerCase().includes(q),
    )
    .slice(0, 8);
}

function renderSearch(popover, query) {
  const matches = searchMatches(query);
  if (!query.trim()) {
    popover.classList.remove('is-open');
    return;
  }
  popover.innerHTML = matches.length
    ? matches.map(([name, type, description]) => `
      <button class="gem-search-result" data-name="${esc(name)}" data-type="${esc(type)}">
        <b>${esc(type)}</b><div><strong>${esc(name)}</strong><span>${esc(description)}</span></div><i>›</i>
      </button>`).join('')
    : '<div class="gem-search-empty">No indexed result yet. Try a mineral, country, target, company or asset.</div>';
  popover.classList.add('is-open');

  popover.querySelectorAll('.gem-search-result').forEach((row) => {
    row.addEventListener('click', () => {
      const name = row.dataset.name;
      const type = row.dataset.type;
      popover.classList.remove('is-open');
      emit('gem:web-search', { query, name, type });
      openModuleFromType(type);
    });
  });
}

function openModuleFromType(type) {
  const map = {
    Commodity: 'intelligence',
    Country: 'security',
    Targets: 'targets',
    Resources: 'resources',
    Companies: 'companies',
    Assets: 'assets',
    Market: 'markets',
  };
  openWorkspace(map[type] || 'intelligence');
}

function workspaceContent(module) {
  const cards = {
    resources: [
      ['QUERY', 'Global Resource Atlas', 'Search depth-resolved resource observations and provenance.', 'OPEN RESOURCE ATLAS', 'gem:web-section', { section: 'resources' }],
      ['DATA', 'Geochemistry', 'Explore geochemical samples and pathfinder evidence.', 'OPEN GEOCHEMISTRY', 'gem:source-toggle', { label: 'Geochemistry', active: true }],
      ['PLANET', 'Planetary Observations', 'Sentinel-2, EnMAP and EMIT observation inventory.', 'OPEN OBSERVATIONS', 'gem:web-section', { section: 'resources' }],
    ],
    targets: [
      ['TARGET', 'Global Target Engine', 'Rank candidates from independent evidence channels and mineral-system context.', 'OPEN LIVE TARGETS', 'gem:open-targets', {}],
      ['DECISION', 'Next-Best Action', 'Move from a target score to the next discriminating exploration action.', 'OPEN DECISION CENTER', 'gem:open-targets', {}],
      ['DRILL', 'Drill Intelligence', 'Compare geological hypotheses and only recommend geometry when evidence supports it.', 'OPEN DRILL INTELLIGENCE', 'gem:open-targets', {}],
    ],
    assets: [
      ['ASSET', 'Global Asset Registry', 'Locate physical assets and follow their verified lifecycle.', 'OPEN ASSET REGISTRY', 'gem:open-asset-registry', {}],
      ['TWIN', 'Asset Digital Twin', 'Connect location, assay, custody, shipment, trade and finance.', 'OPEN DIGITAL TWINS', 'gem:open-asset-registry', {}],
      ['CUSTODY', 'Passport & Custody', 'Trace origin, assay, ownership and custody evidence.', 'OPEN CUSTODY', 'gem:open-asset-registry', {}],
    ],
    companies: [
      ['NETWORK', 'Mining Participants', 'Miners, operators, producers, traders and off-takers.', 'OPEN NETWORK', 'gem:web-section', { section: 'companies' }],
      ['REFINING', 'Refinery Network', 'Smelters, refineries and processing relationships.', 'OPEN REFINERIES', 'gem:web-section', { section: 'companies' }],
      ['CAPITAL', 'Capital Network', 'Banks, funds, lenders and project-finance providers.', 'OPEN CAPITAL', 'gem:web-section', { section: 'capital' }],
    ],
    markets: [
      ['TRADE', 'Commodity Marketplace', 'Offers, bids, matching and physical commodity workflows.', 'OPEN MARKETPLACE', 'gem:open-asset-exchange', {}],
      ['EXCHANGE', 'Global Exchange', 'RFQ, contracts, logistics and settlement orchestration.', 'OPEN EXCHANGE', 'gem:open-asset-exchange', {}],
      ['FINANCE', 'Trade Finance', 'Finance requests and provider matching without pretending approval.', 'OPEN FINANCE', 'gem:web-section', { section: 'capital' }],
    ],
    intelligence: [
      ['EVIDENCE', 'Multisource Evidence', 'Geology, geophysics, geochemistry, spectral and terrain channels.', 'OPEN EVIDENCE', 'gem:open-intelligence', {}],
      ['SYSTEMS', 'Mineral Systems', 'Knowledge graph relationships between targets, commodities, hosts and structures.', 'OPEN MINERAL SYSTEMS', 'gem:open-intelligence', {}],
      ['AI', 'AI Analysis', 'Run deep global intelligence only when requested.', 'RUN AI ANALYSIS', 'gem:run-global-analysis', {}],
    ],
    security: [
      ['COUNTRY', 'Mineral Security Index', 'Import dependence, processing concentration and resilience indicators.', 'OPEN SECURITY', 'gem:web-section', { section: 'country' }],
      ['SUPPLY', 'Supply Chain Graph', 'Trace extraction, concentration, refining and manufacturing dependencies.', 'OPEN SUPPLY CHAIN', 'gem:web-section', { section: 'supply' }],
      ['STRATEGY', 'Government Intelligence', 'Country × mineral profiles, projects, trade and policy signals.', 'OPEN GOVERNMENT INTELLIGENCE', 'gem:web-section', { section: 'country' }],
    ],
    map: [
      ['PLANET', 'Global Surface', 'Start from the planetary map and move into any intelligence layer.', 'OPEN PLANET MAP', 'gem:open-map', {}],
      ['LAYERS', 'Evidence Surfaces', 'Satellite, geology, structure, terrain and infrastructure as discoverable layers.', 'OPEN MAP LAYERS', 'gem:open-map', {}],
      ['SEARCH', 'Map Search', 'Jump to a country, coordinate, project or target.', 'SEARCH THE MAP', 'gem:open-map', {}],
    ],
    reports: [
      ['REPORT', 'Decision Report', 'Turn a target and its evidence into a structured decision package.', 'CREATE REPORT', 'gem:open-reports', {}],
      ['INVESTOR', 'Investor Brief', 'Present platform intelligence, scenarios and opportunities.', 'CREATE INVESTOR BRIEF', 'gem:investor-brief-requested', {}],
      ['EVIDENCE', 'Evidence Package', 'Preserve sources, provenance, confidence and limitations.', 'BUILD EVIDENCE PACKAGE', 'gem:open-reports', {}],
    ],
    investor: [
      ['CAPITAL', 'Investor Room', 'Five-year scenarios, use of funds and public-market readiness.', 'OPEN INVESTOR ROOM', 'gem:open-investor', {}],
      ['MARKETS', 'Public Markets', 'Cap table, equity rounds and IPO-readiness framework.', 'OPEN PUBLIC MARKETS', 'gem:open-investor', {}],
      ['MOAT', 'GEM Network Effects', 'Data, workflow and network advantages across the platform.', 'OPEN INVESTOR INTELLIGENCE', 'gem:open-investor', {}],
    ],
  };
  return cards[module] || cards.intelligence;
}

function openWorkspace(module) {
  let workspace = document.querySelector('.gem-workspace');
  if (!workspace) {
    workspace = document.createElement('section');
    workspace.className = 'gem-workspace';
    document.body.append(workspace);
  }
  const titleMap = Object.fromEntries(MODULES.map((item) => [item.id, item]));
  const meta = titleMap[module] || titleMap.intelligence;
  workspace.innerHTML = `
    <header class="gem-workspace-header">
      <button class="gem-back" data-back>← BACK</button>
      <div><span>${esc(meta.eyebrow)}</span><h2>${esc(meta.label)}</h2></div>
    </header>
    <main class="gem-workspace-body">
      <div class="gem-panel-label">GEM WORKSPACE</div>
      <h1 style="font-size:34px;letter-spacing:-.05em;margin:8px 0 0">${esc(meta.label)}</h1>
      <p style="color:#718993;max-width:720px;font-size:11px;line-height:1.6">${esc(meta.text)}</p>
      <div class="gem-workspace-command">
        <input placeholder="Search within ${esc(meta.label.toLowerCase())}..." data-workspace-search>
        <button data-live>OPEN LIVE VIEW</button>
        <button data-map>MAP</button>
      </div>
      <div class="gem-workspace-grid">
        ${workspaceContent(module).map(([eyebrow,title,text,label,eventName,detail]) => `
          <article class="gem-work-card">
            <span>${esc(eyebrow)}</span>
            <strong>${esc(title)}</strong>
            <p>${esc(text)}</p>
            <button data-event="${esc(eventName)}" data-detail="${esc(JSON.stringify(detail))}">${esc(label)} →</button>
          </article>`).join('')}
      </div>
      <div class="gem-work-note">GEM keeps evidence, provenance and decision boundaries explicit. A prospectivity signal is not a mineral resource, reserve, grade, discovery probability or economic valuation without validated evidence.</div>
    </main>`;
  workspace.classList.add('is-open');

  workspace.querySelector('[data-back]').addEventListener('click', () => workspace.classList.remove('is-open'));
  workspace.querySelector('[data-map]').addEventListener('click', () => {
    workspace.classList.remove('is-open');
    document.querySelector('.gem-product-shell')?.classList.add('is-map-mode');
  });
  workspace.querySelector('[data-live]').addEventListener('click', () => {
    const live = module === 'targets' ? 'gem:open-targets'
      : module === 'assets' ? 'gem:open-asset-registry'
      : module === 'markets' ? 'gem:open-asset-exchange'
      : module === 'investor' ? 'gem:open-investor'
      : module === 'intelligence' ? 'gem:open-intelligence'
      : 'gem:web-section';
    emit(live, live === 'gem:web-section' ? { section: module } : {});
    if (module !== 'resources' && module !== 'companies' && module !== 'security') {
      workspace.classList.remove('is-open');
    }
  });
  workspace.querySelectorAll('[data-event]').forEach((button) => {
    button.addEventListener('click', () => {
      let detail = {};
      try { detail = JSON.parse(button.dataset.detail || '{}'); } catch {}
      emit(button.dataset.event, detail);
    });
  });
}

function openMapView(shell) {
  shell.classList.add('gem-map-focus');
  document.querySelector('.gem-workspace')?.classList.remove('is-open');
  let back = document.querySelector('.gem-map-focus-back');
  if (!back) {
    back = document.createElement('button');
    back.className = 'gem-map-focus-back';
    back.textContent = '← BACK TO GEM';
    document.body.append(back);
    back.addEventListener('click', () => {
      shell.classList.remove('gem-map-focus');
      back.remove();
    });
  }
}

function buildShell() {
  const shell = document.createElement('div');
  shell.className = 'gem-product-shell';
  shell.innerHTML = `
    <header class="gem-product-header">
      <div class="gem-product-brand" data-home>
        <span class="gem-product-mark">G</span>
        <div><strong>GEM</strong><small>GLOBAL EXPLORATION & MINERAL INTELLIGENCE</small></div>
      </div>

      <label class="gem-universal-search">
        <span class="search-icon">⌕</span>
        <input data-search-input placeholder="Search minerals, targets, companies, projects, countries..." autocomplete="off">
        <kbd class="gem-search-key">⌘ K</kbd>
      </label>

      <div class="gem-product-header-actions">
        <button data-nav="explore">EXPLORE</button>
        <button data-nav="targets">TARGETS</button>
        <button data-nav="markets">MARKETS</button>
        <button data-nav="investor">INVESTOR</button>
        <button class="gem-language" data-language>GLOBAL</button>
        <button class="gem-product-profile" data-profile><span class="gem-avatar">G</span><span>Gio</span></button>
      </div>
    </header>

    <main class="gem-product-content">
      <section class="gem-product-hero">
        <div class="gem-product-eyebrow">GLOBAL EXPLORATION & MINERAL INTELLIGENCE</div>
        <h1>Understand the planet.<br><em>Find what matters.</em></h1>
        <p>Search the mineral world, discover opportunities, understand assets and move from evidence to action.</p>

        <label class="gem-hero-search">
          <span>⌕</span>
          <input data-hero-search placeholder="What are you looking for?" autocomplete="off">
          <button data-explore>EXPLORE</button>
        </label>

        <div class="gem-quick-links">
          <button data-query="Gold">Gold</button>
          <button data-query="Copper">Copper</button>
          <button data-query="Lithium">Lithium</button>
          <button data-query="Colombia">Colombia</button>
          <button data-query="GEM Targets">GEM Targets</button>
          <button data-query="Resource Atlas">Resource Atlas</button>
        </div>
      </section>

      <section class="gem-section-heading">
        <div><span>DISCOVER GEM</span><h2>Explore the intelligence universe</h2></div>
        <button data-all-modules>VIEW ALL MODULES →</button>
      </section>
      <section class="gem-module-grid">
        ${MODULES.map((module) => `
          <article class="gem-module-card" data-module="${module.id}">
            <span class="module-eyebrow">${esc(module.eyebrow)}</span>
            <span class="module-arrow">↗</span>
            <div><strong>${esc(module.label)}</strong><p>${esc(module.text)}</p></div>
            <footer><span>${esc(module.meta)}</span><b>OPEN →</b></footer>
          </article>`).join('')}
      </section>

      <section class="gem-lower-grid">
        <article class="gem-feature-panel">
          <div class="gem-panel-label">THE GEM LOOP</div>
          <h3>From planetary evidence to real-world decisions.</h3>
          <p>Discover → Target → Decide → Invest → Drill → Learn. Every layer is connected, but nothing is presented until the user needs it.</p>
          <div class="gem-feature-actions">
            <button class="primary" data-open-module="targets">DISCOVER TARGETS</button>
            <button data-open-module="resources">EXPLORE RESOURCES</button>
            <button data-open-module="assets">VIEW ASSETS</button>
          </div>
        </article>
        <article class="gem-status-panel">
          <div class="gem-panel-label">GEM PLATFORM</div>
          <div class="gem-status-list">
            <div class="gem-status-item"><span>Planetary data fabric</span><b>READY</b></div>
            <div class="gem-status-item"><span>Mineral intelligence</span><b>READY</b></div>
            <div class="gem-status-item"><span>Target engine</span><b>READY</b></div>
            <div class="gem-status-item"><span>Asset intelligence</span><b>READY</b></div>
            <div class="gem-status-item"><span>Markets & capital</span><b>READY</b></div>
          </div>
        </article>
      </section>
    </main>
  `;
  document.body.append(shell);
  return shell;
}

function wireShell(shell) {
  const popover = installSearchPopover();
  const searchInputs = [
    shell.querySelector('[data-search-input]'),
    shell.querySelector('[data-hero-search]'),
  ].filter(Boolean);

  searchInputs.forEach((input) => {
    input.addEventListener('input', () => renderSearch(popover, input.value));
    input.addEventListener('focus', () => renderSearch(popover, input.value));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && input.value.trim()) {
        openWorkspaceFromQuery(input.value.trim());
        popover.classList.remove('is-open');
      }
      if (event.key === 'Escape') popover.classList.remove('is-open');
    });
  });

  document.addEventListener('gem:open-map', () => openMapView(shell));

  shell.querySelector('[data-explore]').addEventListener('click', () => {
    const query = shell.querySelector('[data-hero-search]').value.trim();
    if (query) openWorkspaceFromQuery(query);
    else openWorkspace('resources');
  });

  shell.querySelectorAll('[data-query]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = shell.querySelector('[data-hero-search]');
      input.value = button.dataset.query;
      input.focus();
      renderSearch(popover, input.value);
    });
  });

  shell.querySelectorAll('[data-module]').forEach((card) => {
    card.addEventListener('click', () => openWorkspace(card.dataset.module));
  });
  shell.querySelectorAll('[data-open-module]').forEach((button) => {
    button.addEventListener('click', () => openWorkspace(button.dataset.openModule));
  });
  shell.querySelector('[data-all-modules]').addEventListener('click', () => {
    shell.querySelector('.gem-module-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  shell.querySelectorAll('[data-nav]').forEach((button) => {
    button.addEventListener('click', () => {
      const nav = button.dataset.nav;
      if (nav === 'explore') openWorkspace('resources');
      else if (nav === 'targets') openWorkspace('targets');
      else if (nav === 'markets') openWorkspace('markets');
      else if (nav === 'investor') openWorkspace('investor');
    });
  });

  shell.querySelector('[data-home]').addEventListener('click', () => {
    document.querySelector('.gem-workspace')?.classList.remove('is-open');
    shell.scrollTo({ top: 0, behavior: 'smooth' });
  });

  shell.querySelector('[data-language]').addEventListener('click', () =>
    emit('gem:open-language-settings'),
  );
  shell.querySelector('[data-profile]').addEventListener('click', () =>
    openWorkspace('investor'),
  );

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.gem-universal-search') && !event.target.closest('.gem-hero-search') && !event.target.closest('.gem-search-popover')) {
      popover.classList.remove('is-open');
    }
  });

  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      shell.querySelector('[data-search-input]')?.focus();
    }
  });
}

function openWorkspaceFromQuery(query) {
  const matches = searchMatches(query);
  const type = matches[0]?.[1];
  if (type) {
    emit('gem:web-search', { query, name: matches[0][0], type });
    openModuleFromType(type);
  } else {
    openWorkspace('intelligence');
  }
}

export function installGemWebExperience() {
  if (document.querySelector('.gem-product-shell')) return;
  injectStyles();
  document.body.classList.add('gem-web-product');
  const shell = buildShell();
  wireShell(shell);

  // Keep the automatic locale experience, but present it through the product header.
  document.addEventListener('gem:locale-ready', (event) => {
    const detail = event.detail || {};
    const language = shell.querySelector('[data-language]');
    if (language) language.textContent = (detail.country || 'GLOBAL') + ' · ' + (detail.languageName || detail.language || 'English');
  });

  // Existing specialist actions remain available to the product shell.
  document.addEventListener('gem:open-targets', () => {
    shell.querySelector('.gem-workspace')?.classList.remove('is-open');
  });
}
