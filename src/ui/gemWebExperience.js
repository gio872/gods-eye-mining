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
  { id: 'supply', label: 'Supply Chain', eyebrow: 'CONNECT', text: 'Trace extraction, processing, refining, manufacturing and strategic dependencies.', meta: 'GLOBAL VALUE CHAIN', action: 'supply' },
  { id: 'operations', label: 'Operations', eyebrow: 'OPERATE', text: 'Plan, monitor and manage exploration, projects, logistics and physical assets.', meta: 'OPERATING LAYER', action: 'operations' },
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


const MODULE_ICONS = {
  map: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="18"/><path d="M15 17l9-4 9 4 0 14-9 4-9-4z"/><path d="M24 13v18M15 17l9 4 9-4"/></svg>',
  resources: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 31l10-17 9 4 13-8"/><path d="M8 31l9 7 10-13 13 4"/><path d="M18 14l9 4 13-8"/></svg>',
  targets: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="6"/><path d="M24 3v8M24 37v8M3 24h8M37 24h8"/></svg>',
  assets: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5l15 9v20l-15 9-15-9V14z"/><path d="M9 14l15 9 15-9M24 23v20"/></svg>',
  companies: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 42V18h13v24M27 42V8h13v34M5 42h38"/><path d="M13 23h3M13 29h3M32 14h3M32 20h3M32 26h3"/></svg>',
  markets: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 39V25M20 39V16M32 39V9M44 39H4"/><path d="M7 17l10-7 10 5 14-10"/></svg>',
  intelligence: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M17 33c-7 0-11-4-11-10s4-10 10-10c2-6 12-7 15-1 7-2 13 3 13 10 0 7-5 11-12 11H17z"/><path d="M17 24c4-5 8-5 13 0M21 29c3-3 6-3 9 0"/></svg>',
  security: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5l16 6v11c0 10-6 17-16 21C14 39 8 32 8 22V11z"/><path d="M17 24l5 5 10-12"/></svg>',
  investor: '<svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="16" cy="15" rx="8" ry="4"/><path d="M8 15v7c0 2 4 4 8 4s8-2 8-4v-7"/><path d="M24 15c0-2 4-4 8-4s8 2 8 4v7c0 2-4 4-8 4-2 0-4-.4-5.5-1.2"/><path d="M8 22v7c0 2 4 4 8 4s8-2 8-4v-7"/></svg>',
  reports: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 5h19l7 7v31H12z"/><path d="M31 5v8h7M18 21h14M18 27h14M18 33h9"/></svg>',
  supply: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="10" cy="24" r="4"/><circle cx="38" cy="10" r="4"/><circle cx="38" cy="38" r="4"/><path d="M14 22l20-10M14 26l20 10"/></svg>',
  operations: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M19 8l3 5-5 5-5-3 4-7zM29 40l-3-5 5-5 5 3-4 7z"/><path d="M20 18l10 12M30 18l-10 12"/><circle cx="24" cy="24" r="7"/></svg>'
};

function moduleIcon(id) {
  return MODULE_ICONS[id] || MODULE_ICONS.intelligence;
}

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
      background:rgba(1,5,8,.18);
      overflow:auto;
    }

    .gem-product-shell:after{
      content:"";
      position:fixed;inset:0;z-index:0;pointer-events:none;
      background:
        radial-gradient(ellipse at 50% 57%,rgba(14,194,255,.18),transparent 30%),
        radial-gradient(ellipse at 17% 52%,rgba(0,217,255,.13),transparent 24%),
        radial-gradient(ellipse at 84% 53%,rgba(117,76,255,.12),transparent 25%),
        linear-gradient(180deg,rgba(0,5,11,.12) 0%,rgba(0,8,15,.02) 34%,rgba(0,4,9,.56) 100%),
        url("https://science.nasa.gov/wp-content/uploads/2024/03/blue-marble-apollo-17-16x9-1.jpg") center 50% / cover no-repeat;
      transform:scale(1.035);
      filter:saturate(1.24) contrast(1.12) brightness(.76);
      animation:gemPlanetDrift 40s ease-in-out infinite alternate;
      box-shadow:inset 0 0 240px rgba(0,0,0,.52);
    }
    @keyframes gemPlanetDrift{
      from{transform:scale(1.035) translate3d(0,0,0)}
      to{transform:scale(1.065) translate3d(-.4%,.12%,0)}
    }

    .gem-product-shell:before{
      content:"";
      position:fixed;
      inset:0;
      pointer-events:none;
      opacity:.18;
      z-index:1;
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

    .gem-product-brand strong{font-size:14px;letter-spacing:.025em;color:#f1f8fa}
    .gem-product-brand strong b{color:#68e8f4;font-weight:850}
    .gem-product-brand small{display:block;color:#6e8992;font-size:6px;letter-spacing:.16em;margin-top:2px}
    .gem-product-brand:after{content:"";position:absolute;left:30px;top:59px;width:250px;height:1px;background:linear-gradient(90deg,rgba(104,232,244,.34),transparent)}

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
      text-shadow:0 1px 12px rgba(0,0,0,.18);
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
      max-width:630px;margin:0 auto;color:#b0c4ca;
      font-size:13px;line-height:1.7;
      text-shadow:0 2px 16px rgba(0,0,0,.75);
    }
    .gem-product-hero{position:relative}
    .gem-product-hero:after{
      content:"";
      position:absolute;
      width:720px;height:280px;
      left:50%;top:70px;transform:translateX(-50%);
      border-radius:50%;
      border:1px solid rgba(104,232,244,.10);
      box-shadow:0 0 80px rgba(104,232,244,.07),inset 0 0 80px rgba(104,232,244,.035);
      pointer-events:none;
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

    .gem-module-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
    .gem-module-card{position:relative;min-height:118px;display:grid;grid-template-columns:52px minmax(0,1fr) 78px 16px;align-items:center;gap:10px;padding:10px 11px;border:1px solid rgba(74,211,255,.42);border-radius:13px;overflow:hidden;background:linear-gradient(105deg,rgba(2,15,25,.92),rgba(3,19,29,.64)),radial-gradient(circle at 100% 0%,rgba(28,215,255,.13),transparent 48%);backdrop-filter:blur(12px);box-shadow:inset 0 1px rgba(255,255,255,.05),0 10px 35px rgba(0,0,0,.24),0 0 22px rgba(0,188,255,.035);cursor:pointer;transition:transform .2s,border-color .2s,box-shadow .2s}
    .gem-module-icon{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;z-index:2;border:1px solid rgba(71,224,255,.55);background:radial-gradient(circle,rgba(33,193,255,.20),rgba(3,14,23,.82) 68%);box-shadow:0 0 22px rgba(20,208,255,.16),inset 0 0 18px rgba(70,218,255,.07)}
    .gem-module-icon svg{width:29px;height:29px;fill:none;stroke:#69eaff;stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 5px rgba(75,225,255,.45))}
    .gem-module-copy{min-width:0;position:relative;z-index:2}.gem-module-copy strong{display:block;margin:0 0 4px;font-size:13px;letter-spacing:-.025em;white-space:nowrap}.gem-module-copy p{margin:0;color:#a4bcc5;font-size:7.5px;line-height:1.42;max-width:190px}
    .gem-module-card .module-eyebrow{display:block;color:#68d9e9;font:800 5.5px ui-monospace,monospace;letter-spacing:.18em;margin-bottom:4px}
    .gem-module-art{position:absolute;right:0;top:0;bottom:0;width:86px;background-size:cover;background-position:center;opacity:.86;filter:saturate(1.18) contrast(1.06);mask-image:linear-gradient(90deg,transparent 0%,rgba(0,0,0,.62) 18%,#000 46%);-webkit-mask-image:linear-gradient(90deg,transparent 0%,rgba(0,0,0,.62) 18%,#000 46%);z-index:1}.gem-module-art:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(3,15,23,.88),transparent 55%,rgba(0,0,0,.08)),linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,8,15,.28))}
    .gem-module-card .module-arrow{position:relative;z-index:3;color:#72e7f7;font-size:23px;align-self:center;justify-self:end}.gem-module-card footer{display:none}
    .gem-module-card:hover{transform:translateY(-2px);border-color:rgba(79,229,255,.78);box-shadow:inset 0 1px rgba(255,255,255,.08),0 14px 38px rgba(0,0,0,.3),0 0 28px rgba(0,211,255,.12)}
    .gem-module-icon{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(71,224,255,.55);background:radial-gradient(circle,rgba(33,193,255,.18),rgba(3,14,23,.76) 68%);box-shadow:0 0 22px rgba(20,208,255,.13),inset 0 0 18px rgba(70,218,255,.07)}
    .gem-module-icon svg{width:31px;height:31px;fill:none;stroke:#69eaff;stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 5px rgba(75,225,255,.45))}
    .gem-module-card .module-eyebrow{display:block;color:#68d9e9;font:800 6px ui-monospace,monospace;letter-spacing:.18em;margin-bottom:4px}
    .gem-module-card .module-arrow{position:static;color:#72e7f7;font-size:23px;align-self:center;justify-self:end}
    .gem-module-card strong{display:block;margin:0 0 5px;font-size:14px;letter-spacing:-.025em}
    .gem-module-card p{margin:0;color:#a4bcc5;font-size:8px;line-height:1.45;max-width:230px}
    .gem-module-card footer{display:none}
    .gem-module-card:nth-child(3n){background:linear-gradient(105deg,rgba(2,15,25,.86),rgba(3,19,29,.58)),radial-gradient(circle at 100% 0%,rgba(165,140,255,.10),transparent 48%)}

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


    .gem-header-tagline{position:absolute;left:22px;top:68px;color:#75a8b7;font:700 6px ui-monospace,monospace;letter-spacing:.12em;pointer-events:none}
    .gem-top-nav{position:absolute;left:50%;top:10px;transform:translateX(-50%);height:64px;display:flex;border:1px solid rgba(57,208,255,.42);border-radius:13px;background:rgba(2,13,23,.72);backdrop-filter:blur(18px);overflow:hidden}
    .gem-top-nav button{width:100px;border:0;border-right:1px solid rgba(66,194,235,.14);background:transparent;color:#9bb8c2;font-size:8px;font-weight:800;letter-spacing:.05em;cursor:pointer}
    .gem-top-nav button:last-child{border-right:0}
    .gem-top-nav button span{display:block;font-size:23px;line-height:22px;color:#b9d8e2;margin-bottom:4px}
    .gem-top-nav button.is-active,.gem-top-nav button:hover{color:#dffcff;background:linear-gradient(180deg,rgba(19,173,233,.24),rgba(9,79,108,.08));box-shadow:inset 0 0 22px rgba(24,211,255,.08)}
    .gem-top-nav button.is-active span,.gem-top-nav button:hover span{color:#58e9ff;text-shadow:0 0 12px rgba(50,224,255,.7)}
    .gem-core-status{position:absolute;right:194px;top:19px;height:56px;min-width:220px;padding:0 15px;border:1px solid rgba(45,210,255,.4);border-radius:12px;background:rgba(2,15,24,.7);display:flex;align-items:center;gap:10px}
    .gem-core-status i{width:11px;height:11px;border-radius:50%;background:#13e89a;box-shadow:0 0 13px #13e89a}
    .gem-core-status b{display:block;color:#4fe8ff;font-size:10px;letter-spacing:.05em}.gem-core-status small{display:block;color:#7b969f;font-size:6px;letter-spacing:.1em;margin-top:4px}
    .gem-user-profile{position:absolute;right:18px;top:19px;height:56px;min-width:166px;border:1px solid rgba(74,180,214,.3);border-radius:11px;background:rgba(2,12,20,.7);display:flex;align-items:center;gap:8px;color:#dffcff;cursor:pointer;padding:0 10px}
    .gem-user-profile span:nth-child(2){display:flex;flex-direction:column;text-align:left}.gem-user-profile b{font-size:9px}.gem-user-profile small{font-size:6px;color:#7f9ca5;margin-top:3px}.gem-user-profile em{margin-left:auto;font-style:normal;color:#9cb6bf}
    .gem-cinematic-tools{position:fixed;z-index:3;left:50%;bottom:20px;transform:translateX(-50%);display:flex;padding:5px;border:1px solid rgba(53,198,245,.25);border-radius:13px;background:rgba(2,13,21,.82);backdrop-filter:blur(18px);box-shadow:0 15px 45px rgba(0,0,0,.35)}
    .gem-cinematic-tools button{width:92px;height:58px;border:1px solid transparent;background:rgba(255,255,255,.018);border-radius:9px;color:#a8bec6;cursor:pointer}
    .gem-cinematic-tools button:hover,.gem-cinematic-tools button.is-active{border-color:rgba(69,222,255,.45);background:rgba(33,177,221,.09);color:#62e9ff}
    .gem-cinematic-tools span{display:block;font-size:23px;margin-bottom:5px}.gem-cinematic-tools b{font-size:6px;letter-spacing:.08em}
    .gem-location-card,.gem-coordinate-card{position:fixed;z-index:3;bottom:20px;border:1px solid rgba(55,201,247,.3);border-radius:12px;background:rgba(2,13,21,.8);backdrop-filter:blur(18px);box-shadow:0 15px 40px rgba(0,0,0,.3)}
    .gem-location-card{left:18px;width:255px;padding:13px;display:flex;gap:12px;align-items:center}.gem-location-card .loc-icon{font-size:29px;color:#58e8ff}.gem-location-card small,.gem-coordinate-card small{display:block;color:#809aa4;font:700 6px ui-monospace,monospace;letter-spacing:.13em}.gem-location-card b,.gem-coordinate-card b{display:block;color:#56e7ff;font:800 9px ui-monospace,monospace;margin-top:5px}.gem-location-card em,.gem-coordinate-card em{display:block;color:#79939c;font-size:6px;font-style:normal;margin-top:4px}
    .gem-coordinate-card{right:18px;width:270px;padding:13px;display:flex;align-items:center;justify-content:space-between}.gem-coordinate-card button{width:38px;height:38px;border:1px solid rgba(71,218,255,.25);border-radius:8px;background:rgba(255,255,255,.025);color:#65e8ff;cursor:pointer}
    .gem-product-header .gem-product-mark{border-radius:50%;width:40px;height:40px;font-size:15px}.gem-product-brand strong{font-size:19px}.gem-product-brand small{font-size:6px}
    .gem-product-brand{min-width:300px}
    .gem-product-header{padding-top:0}

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


    @media (max-width:1200px){
      .gem-top-nav button{width:78px}.gem-core-status{right:178px;min-width:190px}.gem-user-profile{right:10px;min-width:150px}
      .gem-module-grid{grid-template-columns:repeat(3,1fr)}
    }
    @media (max-width:850px){
      .gem-header-tagline,.gem-core-status{display:none}.gem-product-header{grid-template-columns:1fr;height:70px}.gem-top-nav{display:none}
      .gem-product-content{width:calc(100% - 24px)}.gem-module-grid{grid-template-columns:repeat(2,1fr)}
      .gem-cinematic-tools{bottom:10px}.gem-location-card,.gem-coordinate-card{display:none}
    }

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
    supply: [
      ['NETWORK', 'Supply Chain Graph', 'Trace extraction, concentration, smelting, refining and manufacturing.', 'OPEN SUPPLY CHAIN', 'gem:web-section', { section: 'supply' }],
      ['REFINING', 'Refinery Intelligence', 'Map processing concentration, facilities and strategic bottlenecks.', 'OPEN REFINERIES', 'gem:web-section', { section: 'supply' }],
      ['SECURITY', 'Critical Dependencies', 'Connect commodities, countries, companies and strategic exposure.', 'OPEN DEPENDENCIES', 'gem:web-section', { section: 'supply' }],
    ],
    operations: [
      ['PROJECTS', 'Project Operations', 'Move from intelligence to exploration, development and execution.', 'OPEN OPERATIONS', 'gem:web-section', { section: 'operations' }],
      ['LOGISTICS', 'Secure Logistics', 'Track high-value cargo, custody, vaulting and delivery workflows.', 'OPEN LOGISTICS', 'gem:web-section', { section: 'logistics' }],
      ['ASSETS', 'Physical Asset Layer', 'Connect assets, digital twins, custody, trade and settlement.', 'OPEN ASSETS', 'gem:open-asset-registry', {}],
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
        <div><strong>TERRAQUEEN <b>GEM</b></strong><small>MINERAL INTELLIGENCE CENTER</small></div>
      </div>
      <div class="gem-header-tagline">GLOBAL EXPLORATION · AI TARGETING · SATELLITE FUSION · MINING INTELLIGENCE</div>
      <nav class="gem-top-nav">
        <button class="is-active" data-nav="explore"><span>◎</span>EXPLORE</button>
        <button data-nav="analyze"><span>⌁</span>ANALYZE</button>
        <button data-nav="targets"><span>◎</span>TARGETS</button>
        <button data-nav="layers"><span>▱</span>LAYERS</button>
        <button data-nav="ai"><span>◉</span>AI</button>
        <button data-nav="reports"><span>▤</span>REPORTS</button>
      </nav>
      <div class="gem-core-status"><i></i><div><b>GEM CORE ONLINE</b><small>MINING ANALYTICS WORKSPACE</small></div></div>
      <button class="gem-user-profile" data-profile><span class="gem-avatar">G</span><span><b>Gio</b><small>TerraQueen</small></span><em>⌄</em></button>
    </header>

    <main class="gem-product-content">
      <section class="gem-product-hero">
        <div class="gem-product-eyebrow">GLOBAL EXPLORATION & MINERAL INTELLIGENCE</div>
        <h1>Understand the planet.<br><em>Find what matters.</em></h1>
        <p>Search the mineral world, discover opportunities, understand assets<br>and move from evidence to action.</p>
        <label class="gem-hero-search">
          <span>⌕</span>
          <input data-hero-search placeholder="Search minerals, targets, companies, projects, countries..." autocomplete="off">
          <button data-explore>EXPLORE →</button>
        </label>
        <div class="gem-quick-links">
          <button data-query="Gold">Gold</button><button data-query="Copper">Copper</button><button data-query="Lithium">Lithium</button>
          <button data-query="Colombia">Colombia</button><button data-query="GEM Targets">GEM Targets</button><button data-query="Resource Atlas">Resource Atlas</button><button data-query="Rare Earths">Rare Earths</button>
        </div>
      </section>

      <section class="gem-module-grid">
        ${MODULES.map((module) => `
          <article class="gem-module-card" data-module="${module.id}">
            <span class="gem-module-icon">\${moduleIcon(module.id)}</span>
            <div class="gem-module-copy">
              <span class="module-eyebrow">\${esc(module.eyebrow)}</span>
              <strong>\${esc(module.label)}</strong>
              <p>\${esc(module.text)}</p>
            </div>
            <span class="gem-module-art" style="background-image:url('\${esc(module.art)}')"></span>
            <span class="module-arrow">›</span>
            <footer><span>${esc(module.meta)}</span><b>OPEN →</b></footer>
          </article>`).join('')}
      </section>

      <div class="gem-cinematic-tools">
        <button data-tool="basemap"><span>◇</span><b>BASEMAP</b></button>
        <button data-tool="voice"><span>♬</span><b>VOICE</b></button>
        <button data-tool="time"><span>◷</span><b>TIME</b></button>
        <button data-tool="measure"><span>╱</span><b>MEASURE</b></button>
        <button data-tool="screenshot"><span>▣</span><b>SCREENSHOT</b></button>
      </div>

      <div class="gem-location-card">
        <span class="loc-icon">⌖</span><div><small>LOCATION</small><b>GLOBAL PLANETARY VIEW</b><em>LIVE INTELLIGENCE SURFACE</em></div>
      </div>
      <div class="gem-coordinate-card">
        <div><small>COORDINATES (CURSOR)</small><b>GLOBAL SEARCH / MAP READY</b><em>OPEN PLANET MAP TO INSPECT</em></div><button data-open-map>⧉</button>
      </div>
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

  shell.querySelectorAll('.gem-cinematic-tools button').forEach((button) => {
    button.addEventListener('click', () => {
      shell.querySelectorAll('.gem-cinematic-tools button').forEach((b) => b.classList.remove('is-active'));
      button.classList.add('is-active');
      const tool = button.dataset.tool;
      if (tool === 'basemap' || tool === 'measure') emit('gem:open-map');
      else if (tool === 'voice') emit('gem:voice-open');
      else if (tool === 'time') emit('gem:time-open');
      else if (tool === 'screenshot') emit('gem:screenshot');
    });
  });
  shell.querySelector('[data-open-map]').addEventListener('click', () => emit('gem:open-map'));

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
  shell.querySelector('[data-all-modules]')?.addEventListener('click', () => {
    shell.querySelector('.gem-module-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  shell.querySelectorAll('[data-nav]').forEach((button) => {
    button.addEventListener('click', () => {
      const nav = button.dataset.nav;
      if (nav === 'explore') openWorkspace('resources');
      else if (nav === 'analyze') openWorkspace('intelligence');
      else if (nav === 'targets') openWorkspace('targets');
      else if (nav === 'layers') openWorkspace('map');
      else if (nav === 'ai') openWorkspace('intelligence');
      else if (nav === 'reports') openWorkspace('reports');
    });
  });

  shell.querySelector('[data-home]').addEventListener('click', () => {
    document.querySelector('.gem-workspace')?.classList.remove('is-open');
    shell.scrollTo({ top: 0, behavior: 'smooth' });
  });

  shell.querySelector('[data-profile]').addEventListener('click', () => openWorkspace('investor'));

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
  document.title = 'TerraQueen GEM — Mineral Intelligence System';
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
