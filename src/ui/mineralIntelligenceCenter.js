/**
 * GEM Mineral Intelligence Center
 * Presentation layer for the God's Eye View application.
 * Keeps the existing Cesium/GIS controls intact and adds a focused
 * mineral-exploration command center shell around them.
 */
const SOURCE_GROUPS = [
  {
    title: "SATELLITE & SPECTRAL",
    items: [
      ["Sentinel-2 (MSI)", "S2", true],
      ["EMIT L2BMIN", "EM", true],
      ["EnMAP", "EN", true],
      ["Landsat 8/9", "LS", false],
      ["ASTER", "AS", false],
    ],
  },
  {
    title: "GEOLOGY & STRUCTURE",
    items: [
      ["Geological Maps", "GE", true],
      ["Structures / Faults", "ST", true],
      ["Lineaments (AI)", "LI", true],
      ["Tectonic Setting", "TE", false],
    ],
  },
  {
    title: "TERRAIN & ENVIRONMENT",
    items: [
      ["DEM / Topography", "DM", true],
      ["Slope & Aspect", "SA", false],
      ["Hydrology", "HY", true],
      ["Land Cover", "LC", true],
    ],
  },
  {
    title: "GEOCHEMISTRY",
    items: [
      ["Soil Geochem", "SG", true],
      ["Stream Sediments", "SS", false],
      ["Geochemical Anomalies", "GA", true],
    ],
  },
  {
    title: "INFRASTRUCTURE & ACCESS",
    items: [
      ["Towns & Cities", "TC", true],
      ["Roads & Logistics", "RL", true],
      ["Power & Energy", "PE", true],
      ["Protected Areas", "PA", true],
    ],
  },
];

const TARGETS = [
  ["GEM-004281", "94.7", "TIER 1", "4.6231° S · 72.1885° W"],
  ["GEM-004117", "88.2", "TIER 2", "4.6510° S · 72.2410° W"],
  ["GEM-003982", "81.6", "TIER 2", "4.7014° S · 72.1052° W"],
];

function el(tag, className, textContent = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textContent) node.textContent = textContent;
  return node;
}

function icon(name) {
  const s = el("span", "material-symbols-outlined", name);
  s.setAttribute("aria-hidden", "true");
  return s;
}

function sourcePanel() {
  const panel = el("aside", "gem-sources-panel");
  panel.innerHTML = '<div class="gem-panel-kicker">INTELLIGENCE SOURCES</div>';
  SOURCE_GROUPS.forEach(({ title: groupTitle, items }) => {
    const section = el("section", "gem-source-group");
    const head = el("button", "gem-source-heading", groupTitle);
    head.type = "button";
    head.append(icon("expand_more"));
    head.addEventListener("click", () => section.classList.toggle("is-collapsed"));
    section.append(head);
    const list = el("div", "gem-source-list");
    items.forEach(([label, code, active]) => {
      const row = el("div", "gem-source-row");
      row.innerHTML = '<span class="gem-source-code"></span><span class="gem-source-name"></span>';
      row.querySelector(".gem-source-code").textContent = code;
      row.querySelector(".gem-source-name").textContent = label;
      const toggle = el("button", "gem-toggle" + (active ? " is-on" : ""));
      toggle.type = "button";
      toggle.setAttribute("aria-pressed", String(active));
      toggle.title = active ? "Disable source" : "Enable source";
      toggle.addEventListener("click", () => {
        const on = toggle.classList.toggle("is-on");
        toggle.setAttribute("aria-pressed", String(on));
        toggle.title = on ? "Disable source" : "Enable source";
        document.dispatchEvent(new CustomEvent("gem:source-toggle", { detail: { label, active: on } }));
      });
      row.append(toggle);
      list.append(row);
    });
    section.append(list);
    panel.append(section);
  });
  const engine = el("div", "gem-engine-card");
  engine.innerHTML = '<div class="gem-engine-title">GEM AI ENGINE</div><div class="gem-engine-sub">SCANNING TERRITORY</div><div class="gem-progress"><i></i></div><div class="gem-engine-stats"><b>12,482</b><span>km² analyzed</span><b>8,421</b><span>spectral anomalies</span><b>384</b><span>structural intersections</span><b>67</b><span>high-priority targets</span></div>';
  const run = el("button", "gem-primary-button", "RUN INTELLIGENCE ANALYSIS");
  run.type = "button";
  run.addEventListener("click", () => runAnalysis(run));
  engine.append(run);
  panel.append(engine);
  return panel;
}

function targetPanel() {
  const panel = el("aside", "gem-target-panel gem-mining-panel");
  panel.innerHTML = `
    <div class="gem-target-head">
      <div><span class="gem-panel-kicker">MINING INTELLIGENCE</span><strong>TERRAQUEEN MINING</strong></div>
      <span class="gem-tier tier-1">GEM CORE</span>
    </div>
    <div class="gem-target-location">GLOBAL MINING WORKSPACE <span>•</span> MULTI-SENSOR ANALYSIS</div>

    <div class="gem-target-tabs gem-mining-tabs" role="tablist">
      <button class="is-active" data-tab="overview">Overview</button>
      <button data-tab="geology">Geology</button>
      <button data-tab="geophysics">Geophysics</button>
      <button data-tab="geochemistry">Geochemistry</button>
      <button data-tab="spectral">Spectral</button>
      <button data-tab="resources">Resources</button>
    </div>

    <section class="gem-mining-command">
      <div class="gem-section-title">MINING MODULES</div>
      <div class="gem-mining-module-grid">
        <button data-mining-module="exploration"><b>01</b><span>EXPLORATION</span><small>Regional screening</small></button>
        <button data-mining-module="geology"><b>02</b><span>GEOLOGY</span><small>Lithology · structures</small></button>
        <button data-mining-module="geophysics"><b>03</b><span>GEOPHYSICS</span><small>Subsurface · anomalies</small></button>
        <button data-mining-module="geochemistry"><b>04</b><span>GEOCHEMISTRY</span><small>Pathfinders · soil</small></button>
        <button data-mining-module="spectral"><b>05</b><span>SPECTRAL</span><small>EMIT · EnMAP · S2</small></button>
        <button data-mining-module="targets"><b>06</b><span>AI TARGETS</span><small>Prospectivity engine</small></button>
        <button data-mining-module="resources"><b>07</b><span>RESOURCES</span><small>Grade · volume</small></button>
        <button data-mining-module="planning"><b>08</b><span>MINE PLANNING</span><small>Access · scenarios</small></button>
        <button data-mining-module="environment"><b>09</b><span>ENVIRONMENT</span><small>Water · land · ESG</small></button>
        <button data-mining-module="concessions"><b>10</b><span>CONCESSIONS</span><small>Titles · boundaries</small></button>
      </div>
    </section>

    <section class="gem-mining-stats">
      <div><span>COMMODITY</span><b>Au · Cu · Mo · Ag</b></div>
      <div><span>PROSPECTIVITY</span><b>94.7 / 100</b></div>
      <div><span>CONFIDENCE</span><b>HIGH · 94%</b></div>
      <div><span>ACTIVE SENSORS</span><b>S2 · EMIT · EnMAP</b></div>
    </section>

    <section class="gem-mining-evidence">
      <div class="gem-section-title">MINING EVIDENCE CONVERGENCE</div>
      <div class="gem-evidence-row"><span>Geological compatibility</span><i><b style="width:95%"></b></i><em>95%</em></div>
      <div class="gem-evidence-row"><span>Geophysical response</span><i><b style="width:91%"></b></i><em>91%</em></div>
      <div class="gem-evidence-row"><span>Geochemical support</span><i><b style="width:82%"></b></i><em>82%</em></div>
      <div class="gem-evidence-row"><span>Spectral alteration</span><i><b style="width:96%"></b></i><em>96%</em></div>
      <div class="gem-evidence-row"><span>AI target confidence</span><i><b style="width:94%"></b></i><em>94%</em></div>
    </section>

    <section class="gem-mining-targets">
      <div class="gem-section-title">TARGET QUEUE</div>
      <div class="gem-mining-target-row"><b>GEM-004281</b><span>TIER 1</span><em>94.7</em></div>
      <div class="gem-mining-target-row"><b>GEM-004279</b><span>TIER 2</span><em>88.3</em></div>
      <div class="gem-mining-target-row"><b>GEM-004266</b><span>TIER 2</span><em>84.9</em></div>
    </section>

    <div class="gem-action">
      <div><span class="gem-section-title">NEXT MINING ACTION</span><strong>FIELD VALIDATION</strong><small>Prioritize geological, geochemical and spectral validation.</small></div>
      <span class="gem-action-arrow">›</span>
    </div>

    <div class="gem-target-actions">
      <button data-action="analysis">RUN MINING ANALYSIS</button>
      <button data-action="target">OPEN TARGET</button>
      <button data-action="report">MINING REPORT</button>
    </div>
  `;

  panel.querySelectorAll(".gem-target-tabs button").forEach(btn=>{
    btn.addEventListener("click",()=>{
      panel.querySelectorAll(".gem-target-tabs button").forEach(x=>x.classList.remove("is-active"));
      btn.classList.add("is-active");
      document.dispatchEvent(new CustomEvent("gem:mining-tab",{detail:{tab:btn.dataset.tab}}));
      showToast("MINING · "+btn.textContent.trim());
    });
  });
  panel.querySelectorAll("[data-mining-module]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      panel.querySelectorAll("[data-mining-module]").forEach(x=>x.classList.remove("is-active"));
      btn.classList.add("is-active");
      document.dispatchEvent(new CustomEvent("gem:mining-module",{detail:{
        module:btn.dataset.miningModule,
        label:btn.querySelector("span")?.textContent?.trim()||"MINING MODULE"
      }}));
      showToast((btn.querySelector("span")?.textContent||"MINING")+" · ACTIVATING");
    });
  });
  panel.querySelectorAll(".gem-target-actions button").forEach(btn=>btn.addEventListener("click",()=>showToast(btn.textContent)));
  return panel;
}

function bottomIntelligence() {
  const wrap=el("section","gem-bottom-intelligence");
  wrap.innerHTML=`
    <div class="gem-bottom-card fusion"><div class="gem-section-title">MULTI-SENSOR FUSION</div><div class="gem-fusion-stack"><span>S2</span><span>EMIT</span><span>EnMAP</span><span>GEO</span><span>DEM</span><span>GEO-CHEM</span><b>→</b><strong>GEM AI FUSION ENGINE</strong></div></div>
    <div class="gem-bottom-card spectral"><div class="gem-section-title">SPECTRAL ANALYSIS</div><div class="gem-chart"><i></i><i></i><i></i><i></i><i></i></div><div class="gem-chart-labels"><span>400</span><span>800</span><span>1200</span><span>1600</span><span>2400 nm</span></div><div class="gem-mineral-tags"><span>Kaolinite</span><span>Alunite</span><span>Illite</span><span>Chlorite</span><span>Hematite</span></div></div>
    <div class="gem-bottom-card terrain"><div class="gem-section-title">3D TERRAIN & GEOLOGY</div><div class="gem-terrain-art"><b>GEM-004281</b><span>ALTERATION ZONE</span><i>STRUCTURAL CONTROL</i></div></div>
    <div class="gem-bottom-card priority"><div class="gem-section-title">TARGET PRIORITY</div><div class="gem-priority-row"><b class="p1">●</b><span>TIER 1</span><em>Critical Target</em></div><div class="gem-priority-row"><b class="p2">●</b><span>TIER 2</span><em>High Potential</em></div><div class="gem-priority-row"><b class="p3">●</b><span>TIER 3</span><em>Prospective</em></div><div class="gem-priority-row"><b class="p4">●</b><span>TIER 4</span><em>Background</em></div></div>
  `;
  return wrap;
}

function topHeader() {
  const header=el("header","gem-command-header");
  header.innerHTML=`
    <div class="gem-brand"><span class="gem-brand-mark">G</span><div><strong>GEM <small>MINERAL INTELLIGENCE CENTER</small></strong><em>GLOBAL EXPLORATION & MINERAL INTELLIGENCE ENGINE</em></div></div>
    <nav class="gem-main-nav">
      <button class="is-active">◉ <span>TERRAQUEEN MINING INTELLIGENCE</span></button><button>◇ <span>GLOBAL</span></button><button>□ <span>COUNTRY</span></button><button>⌂ <span>REGION</span></button><button>◎ <span>PROSPECT</span></button><button>⊙ <span>TARGET</span></button><button>◇ <span>3D</span></button><button>⌁ <span>AI ANALYSIS</span></button><button>▣ <span>REPORTS</span></button>
    </nav>
    <div class="gem-user"><span class="gem-online"></span><strong>Gio</strong><small>TerraQueen</small><span>⌄</span></div>
  `;
  header.querySelectorAll(".gem-main-nav button").forEach(btn=>btn.addEventListener("click",()=>{
    header.querySelectorAll(".gem-main-nav button").forEach(x=>x.classList.remove("is-active"));
    btn.classList.add("is-active");
    showToast(btn.textContent.trim());
  }));
  return header;
}

function mapHud() {
  const hud=el("div","gem-map-hud");
  hud.innerHTML=`
    <div class="gem-map-search">⌕ <span>Search location, project or coordinates...</span></div>
    <div class="gem-map-modes"><button class="is-active">Satellite</button><button>Topography</button><button>Geology</button><button>Alteration</button><button>Structures</button><button>Mineral Potential</button><button>Infrastructure</button></div>
    <div class="gem-map-meta">ZOOM 10.5 · SCALE 1:250,000 · EPSG:4326 · SENSOR: EMIT L2BMIN · RESOLUTION: 60 m</div>
  `;
  return hud;
}

function showToast(message){
  let t=document.querySelector(".gem-toast");
  if(!t){t=el("div","gem-toast");document.body.append(t);}
  t.textContent=message;
  t.classList.add("is-visible");
  clearTimeout(t._timer); t._timer=setTimeout(()=>t.classList.remove("is-visible"),1800);
}

function runAnalysis(button){
  button.disabled=true;
  button.textContent="RUNNING GEM ANALYSIS…";
  const bar=document.querySelector(".gem-engine-card .gem-progress i");
  let value=0;
  const timer=setInterval(()=>{
    value=Math.min(100,value+10);
    bar.style.width=value+"%";
    if(value===100){
      clearInterval(timer);
      button.disabled=false;
      button.textContent="ANALYSIS COMPLETE";
      setTimeout(()=>button.textContent="RUN INTELLIGENCE ANALYSIS",1500);
      showToast("GEM intelligence analysis complete");
    }
  },90);
}

function forceGemCommandCenter() {
  if (!document.body || document.querySelector(".gem-command-center-force")) return;
  document.documentElement.dataset.product = "GEM Mineral Intelligence Center";
  document.documentElement.dataset.gemExperience = "center";

  const legacy = "#first-run-launcher,#loading-screen,#intel-hud,#title-bar,#style-indicator,#left-panel-stack,#right-panel-stack,#right-context-rail,#command-dock,#location-bar,#voice-bar,#top-center-actions,#traffic-sync-chip,#cctv-sync-chip,#safe-frame-overlay";
  const hideLegacy = () => document.querySelectorAll(legacy).forEach((n) => {
    n.style.setProperty("display","none","important");
    n.style.setProperty("visibility","hidden","important");
    n.style.setProperty("pointer-events","none","important");
  });
  hideLegacy();

  const layer = (iconCode, title, sub) => `
    <div class="gcf-layer"><span class="gcf-layer-icon">${iconCode}</span><div><b>${title}</b><small>${sub}</small></div><button type="button" class="gcf-check" aria-pressed="true">✓</button><span class="gcf-chevron">›</span></div>`;

  const shell = document.createElement("div");
  shell.className = "gem-command-center-force";
  shell.innerHTML = `
    <header class="gcf-header">
      <div class="gcf-brand">
        <img class="gcf-logo" src="/logo.svg" alt="" aria-hidden="true" />
        <div class="gcf-brand-copy">
          <strong>TERRAQUEEN</strong>
          <b>GEM <small>MINERAL INTELLIGENCE CENTER</small></b>
          <em>GEOSPATIAL EXPLORATION · AI TARGETING · SATELLITE FUSION · MINING INTELLIGENCE</em>
        </div>
      </div>
      <nav aria-label="GEM navigation">
        <button class="active" type="button"><span class="gcf-nav-icon">◉</span><span>EXPLORE</span></button>
        <button type="button"><span class="gcf-nav-icon">⌁</span><span>ANALYZE</span></button>
        <button type="button"><span class="gcf-nav-icon">◎</span><span>TARGETS</span></button>
        <button type="button"><span class="gcf-nav-icon">▱</span><span>LAYERS</span></button>
        <button type="button"><span class="gcf-nav-icon">◈</span><span>AI</span></button>
        <button type="button"><span class="gcf-nav-icon">▣</span><span>REPORTS</span></button>
      </nav>
      <div class="gcf-status"><i></i><strong>GEM CORE ONLINE</strong><small>MINING ANALYTICS WORKSPACE</small></div>
      <time>LIVE · MULTI-SENSOR<br><b>2026-10-07 04:07:28Z</b><br><small>ORB: 4769 · PASS: DESC-117</small></time>
    </header>

    <aside class="gcf-left">
      <div class="gcf-panel-head"><h3>DATA LAYERS</h3><button type="button" aria-label="Collapse data layers">⌃</button></div>
      <div class="gcf-tabs"><b>MINERAL</b><span>GEOSCIENCE</span><span>ENVIRONMENT</span><span>INFRASTRUCTURE</span></div>
      <div class="gcf-layer-list">
        ${layer("◌","Satellite Imagery","Sentinel-2 · Landsat · Planet")}
        ${layer("◈","Spectral Analysis","EMIT · EnMAP · ASTER")}
        ${layer("◇","Geological Mapping","Lithology · Structures · Alteration")}
        ${layer("◌","Geochemistry","Anomalies · Pathfinder elements")}
        ${layer("✦","Mineral Prospectivity (AI)","GEM Target Engine")}
        ${layer("▱","Mining Concessions","Titles · Claim Boundaries")}
        ${layer("△","Infrastructure","Roads · Power · Ports")}
        ${layer("♢","Hydrology","Rivers · Drainage · Water Index")}
        ${layer("⌁","Topography","DEM · Slope · Hillshade")}
        ${layer("✺","Environment","Protected Areas · Forest · Land Use")}
      </div>
      <button class="gcf-add-layer" type="button">＋ ADD CUSTOM LAYER</button>
    </aside>

    <aside class="gcf-right">
      <div class="gcf-panel-head"><h3>VIEW CONTROLS</h3><button type="button" aria-label="Collapse view controls">⌃</button></div>
      <div class="gcf-views"><button type="button">2D MAP</button><button type="button" class="active">3D GLOBE</button><button type="button">SPLIT VIEW</button></div>
      <h3>ANALYTICS TOOLS</h3>
      <button type="button">◫ <span>Spectral Analysis</span><b>›</b></button>
      <button type="button">◌ <span>Target Detection (AI)</span><b>›</b></button>
      <button type="button">⌁ <span>Geological Interpretation</span><b>›</b></button>
      <button type="button">◍ <span>Change Detection</span><b>›</b></button>
      <button type="button">⇩ <span>Export & Reports</span><b>›</b></button>
      <h3>CONTEXT</h3>
      <button type="button">▣ <span>CCTV / Live Feeds</span><b class="count">3</b></button>
      <button type="button">◇ <span>External Maps</span><b class="count">4</b></button>
      <button type="button">□ <span>Project Area</span><b>›</b></button>
    </aside>

    <main class="gcf-center">
      <div class="gcf-hero-card">
        <div class="gcf-kicker">TERRAQUEEN · GEM CORE · MINERAL INTELLIGENCE</div>
        <div class="gcf-hero-title"><span>TERRAQUEEN</span><strong>GEM</strong><b>MINERAL INTELLIGENCE CENTER</b></div>
        <p>Satellite intelligence · hyperspectral analysis · geological interpretation · AI mineral targeting</p>

        <div class="gcf-hero-orbit" aria-hidden="true">
          <svg viewBox="0 0 860 330" role="presentation">
            <defs>
              <radialGradient id="gcf-earth" cx="50%" cy="35%">
                <stop offset="0%" stop-color="#59dcff" stop-opacity=".95"/>
                <stop offset="44%" stop-color="#158ab8"/>
                <stop offset="73%" stop-color="#073c59"/>
                <stop offset="100%" stop-color="#020b12"/>
              </radialGradient>
              <filter id="gcf-glow"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              <linearGradient id="gcf-track" x1="0" x2="1"><stop stop-color="#2de5ff" stop-opacity="0"/><stop offset=".5" stop-color="#2de5ff" stop-opacity=".9"/><stop offset="1" stop-color="#2de5ff" stop-opacity="0"/></linearGradient>
            </defs>
            <ellipse cx="430" cy="265" rx="300" ry="46" fill="none" stroke="#23d9ff" stroke-opacity=".22"/>
            <ellipse cx="430" cy="246" rx="265" ry="36" fill="none" stroke="url(#gcf-track)" stroke-width="3" filter="url(#gcf-glow)"/>
            <circle cx="430" cy="252" r="128" fill="url(#gcf-earth)" stroke="#70ecff" stroke-opacity=".65" stroke-width="2" filter="url(#gcf-glow)"/>
            <path d="M332 244c40-42 58-51 87-44 20 5 29 23 51 16 25-8 34 4 58 22 13 10 28 12 42 25" fill="none" stroke="#44e3ff" stroke-width="5" stroke-linecap="round" opacity=".7"/>
            <path d="M347 275c34-10 52-4 76 14 22 17 55 11 85 0 22-8 51-7 71 4" fill="none" stroke="#f1b848" stroke-width="4" stroke-linecap="round" opacity=".75"/>
            <g class="gcf-sat gcf-sat-1" transform="translate(88 58)">
              <rect x="38" y="18" width="54" height="24" rx="4" fill="#dcecf2"/><rect x="-2" y="18" width="34" height="24" fill="#2d75a9"/><rect x="94" y="18" width="34" height="24" fill="#2d75a9"/>
              <path d="M92 18l-5-28 11 5 6 23M38 18l5-28-11 5-6 23" fill="none" stroke="#a9c6d0" stroke-width="4"/>
              <circle cx="65" cy="30" r="6" fill="#173746" stroke="#69ddff"/>
              <text x="1" y="65" fill="#cdebf0" font-size="15" font-family="JetBrains Mono">Sentinel-2</text>
            </g>
            <g class="gcf-sat gcf-sat-2" transform="translate(620 54) rotate(-18)">
              <rect x="38" y="18" width="54" height="24" rx="4" fill="#d9e8ed"/><rect x="-2" y="18" width="34" height="24" fill="#315b88"/><rect x="94" y="18" width="34" height="24" fill="#315b88"/>
              <circle cx="65" cy="30" r="6" fill="#183746" stroke="#69ddff"/>
              <text x="24" y="65" fill="#cdebf0" font-size="15" font-family="JetBrains Mono">EnMAP</text>
            </g>
            <g class="gcf-sat gcf-sat-3" transform="translate(96 168) rotate(12)">
              <rect x="38" y="15" width="48" height="22" rx="4" fill="#cbd8df"/><rect x="1" y="16" width="29" height="20" fill="#215d95"/><rect x="91" y="16" width="29" height="20" fill="#215d95"/>
              <circle cx="62" cy="26" r="5" fill="#183746" stroke="#69ddff"/>
              <text x="48" y="61" fill="#cdebf0" font-size="15" font-family="JetBrains Mono">EMIT</text>
            </g>
            <g class="gcf-sat gcf-sat-4" transform="translate(622 172) rotate(-8)">
              <rect x="38" y="15" width="48" height="22" rx="4" fill="#cbd8df"/><rect x="1" y="16" width="29" height="20" fill="#2c659d"/><rect x="91" y="16" width="29" height="20" fill="#2c659d"/>
              <circle cx="62" cy="26" r="5" fill="#183746" stroke="#69ddff"/>
              <text x="40" y="61" fill="#cdebf0" font-size="15" font-family="JetBrains Mono">Landsat</text>
            </g>
          </svg>
        </div>

        <div class="gcf-hero-tags"><span>SATELLITE INTELLIGENCE</span><i>•</i><span>GEOLOGICAL ANALYSIS</span><i>•</i><span>AI TARGETING</span><i>•</i><span>SUSTAINABLE MINING</span></div>
        <div class="gcf-metrics">
          <div><b>◎</b><strong>SATELLITE FUSION</strong><small>Sentinel-2<br>EMIT<br>EnMAP<br>Landsat</small></div>
          <div><b>◈</b><strong>GEOLOGY</strong><small>Lithology<br>Structures<br>Alteration</small></div>
          <div><b>✦</b><strong>AI TARGETING</strong><small>Mineral<br>Prospectivity<br>GEM Engine</small></div>
          <div><b>♢</b><strong>ENVIRONMENT</strong><small>Land Use<br>Biodiversity<br>Water Resources</small></div>
          <div><b>△</b><strong>INFRASTRUCTURE</strong><small>Access<br>Energy<br>Logistics</small></div>
        </div>
        <button class="gcf-init" type="button"><span>INITIALIZE GEM</span><small>MINERAL INTELLIGENCE CENTER</small><b>›</b></button>
        <label class="gcf-suppress"><input type="checkbox" /><span>Don't show this again</span></label>
        <span class="gcf-esc">ESC TO DISMISS</span>
      </div>
    </main>

    <footer class="gcf-bottom">
      <div class="gcf-location"><span>⌖ LOCATION</span><b>30°16'01.92"N · 097°44'35.16"W</b><small>Elev: 142 m</small></div>
      <nav>
        <button type="button">⌂<span>BASEMAP</span></button>
        <button type="button" class="active">♩<span>VOICE</span></button>
        <button type="button">◷<span>TIME</span></button>
        <button type="button">∕<span>MEASURE</span></button>
        <button type="button">▣<span>SCREENSHOT</span></button>
      </nav>
      <div class="gcf-location cursor"><span>COORDINATES (CURSOR)</span><b>30°16'02.10"N · 097°44'28.73"W</b><small>Elev: 138 m</small></div>
    </footer>
  `;
  document.body.append(shell);

  shell.querySelectorAll(".gcf-layer .gcf-check").forEach((btn) => {
    btn.addEventListener("click", () => {
      const active = btn.getAttribute("aria-pressed") === "true";
      btn.setAttribute("aria-pressed", String(!active));
      btn.textContent = active ? "○" : "✓";
      btn.closest(".gcf-layer")?.classList.toggle("is-off", active);
      document.dispatchEvent(new CustomEvent("gem:layer-toggle", {
        detail: { label: btn.closest(".gcf-layer")?.querySelector("b")?.textContent || "", active: !active },
      }));
    });
  });

  shell.querySelectorAll(".gcf-header nav button").forEach((btn) => btn.addEventListener("click", () => {
    shell.querySelectorAll(".gcf-header nav button").forEach((x) => x.classList.remove("active"));
    btn.classList.add("active");
    showToast(btn.textContent.trim());
  }));
  shell.querySelectorAll(".gcf-right > button,.gcf-views button,.gcf-bottom nav button").forEach((btn) => btn.addEventListener("click", () => showToast(btn.textContent.replace(/\s+/g," ").trim())));
  shell.querySelectorAll("[data-gem-module]").forEach((btn) => btn.addEventListener("click", () => {
    shell.querySelectorAll("[data-gem-module]").forEach((x) => x.classList.remove("active"));
    btn.classList.add("active");
    const moduleName = btn.querySelector("span")?.textContent?.trim() || "MINING MODULE";
    document.dispatchEvent(new CustomEvent("gem:mining-module", { detail: { module: btn.dataset.gemModule, label: moduleName } }));
    showToast(moduleName + " · GEM MODULE");
  }));

  shell.querySelector(".gcf-init")?.addEventListener("click", () => {
    shell.classList.add("gcf-launching");
    setTimeout(() => {
      shell.remove();
      document.documentElement.dataset.gemExperience = "center";
      hideLegacy();
      if (typeof window.startGemBoot === "function") window.startGemBoot();
    }, 520);
  });
}
export function installMineralIntelligenceCenter(){
  const install=()=>{
    forceGemCommandCenter();
    document.body.classList.add("gem-mineral-center");
    document.documentElement.dataset.gemCenterInstalled="true";
    // Static scene chrome owns the GEM shell. Runtime mounting remains as a
    // fallback for alternate hosts, but never duplicates the static shell.
    if(!document.querySelector(".gem-command-header")){
      document.body.append(topHeader());
      document.body.append(mapHud());
      document.body.append(sourcePanel());
      document.body.append(targetPanel());
      document.body.append(bottomIntelligence());
    }
    // Future cockpit mode retains the original functional controls.
    document.documentElement.dataset.gemExperience = "center";
    const launch = document.querySelector("[data-gem-initialize]");
    launch?.addEventListener("click", () => {
      document.querySelector(".gem-launch-panel")?.classList.add("is-launching");
      const existingGemEntry = document.querySelector("[data-first-run-gem]");
      if (existingGemEntry) existingGemEntry.click();
      else {
        document.documentElement.dataset.gemExperience = "center";
        document.body.classList.add("gem-center-active");
      }
    }, { once: true });

  };
  if(document.body) install();
  else document.addEventListener("DOMContentLoaded",install,{once:true});
}
