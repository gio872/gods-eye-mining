/**
 * GEM Mineral Intelligence Center
 * Presentation layer for the God's Eye View application.
 * Keeps the existing Cesium/GIS controls intact and adds a focused
 * mineral-exploration command center shell around them.
 */
const SOURCE_GROUPS = [
  {
    title: 'SATELLITE & SPECTRAL',
    items: [
      ['Sentinel-2 (MSI)', 'S2', true],
      ['EMIT L2BMIN', 'EM', true],
      ['EnMAP', 'EN', true],
      ['Landsat 8/9', 'LS', false],
      ['ASTER', 'AS', false],
    ],
  },
  {
    title: 'GEOLOGY & STRUCTURE',
    items: [
      ['Geological Maps', 'GE', true],
      ['Structures / Faults', 'ST', true],
      ['Lineaments (AI)', 'LI', true],
      ['Tectonic Setting', 'TE', false],
    ],
  },
  {
    title: 'TERRAIN & ENVIRONMENT',
    items: [
      ['DEM / Topography', 'DM', true],
      ['Slope & Aspect', 'SA', false],
      ['Hydrology', 'HY', true],
      ['Land Cover', 'LC', true],
    ],
  },
  {
    title: 'GEOCHEMISTRY',
    items: [
      ['Soil Geochem', 'SG', true],
      ['Stream Sediments', 'SS', false],
      ['Geochemical Anomalies', 'GA', true],
    ],
  },
  {
    title: 'INFRASTRUCTURE & ACCESS',
    items: [
      ['Towns & Cities', 'TC', true],
      ['Roads & Logistics', 'RL', true],
      ['Power & Energy', 'PE', true],
      ['Protected Areas', 'PA', true],
    ],
  },
];

const TARGETS = [
  ['GEM-004281', '94.7', 'TIER 1', '4.6231° S · 72.1885° W'],
  ['GEM-004117', '88.2', 'TIER 2', '4.6510° S · 72.2410° W'],
  ['GEM-003982', '81.6', 'TIER 2', '4.7014° S · 72.1052° W'],
];

function el(tag, className, textContent = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textContent) node.textContent = textContent;
  return node;
}

function icon(name) {
  const s = el('span', 'material-symbols-outlined', name);
  s.setAttribute('aria-hidden', 'true');
  return s;
}

function sourcePanel() {
  const panel = el('aside', 'gem-sources-panel');
  panel.innerHTML = '<div class="gem-panel-kicker">INTELLIGENCE SOURCES</div>';
  SOURCE_GROUPS.forEach(({ title: groupTitle, items }) => {
    const section = el('section', 'gem-source-group');
    const head = el('button', 'gem-source-heading', groupTitle);
    head.type = 'button';
    head.append(icon('expand_more'));
    head.addEventListener('click', () =>
      section.classList.toggle('is-collapsed'),
    );
    section.append(head);
    const list = el('div', 'gem-source-list');
    items.forEach(([label, code, active]) => {
      const row = el('div', 'gem-source-row');
      row.innerHTML =
        '<span class="gem-source-code"></span><span class="gem-source-name"></span>';
      row.querySelector('.gem-source-code').textContent = code;
      row.querySelector('.gem-source-name').textContent = label;
      const toggle = el('button', 'gem-toggle' + (active ? ' is-on' : ''));
      toggle.type = 'button';
      toggle.setAttribute('aria-pressed', String(active));
      toggle.title = active ? 'Disable source' : 'Enable source';
      toggle.addEventListener('click', () => {
        const on = toggle.classList.toggle('is-on');
        toggle.setAttribute('aria-pressed', String(on));
        toggle.title = on ? 'Disable source' : 'Enable source';
        document.dispatchEvent(
          new CustomEvent('gem:source-toggle', {
            detail: { label, active: on },
          }),
        );
      });
      row.append(toggle);
      list.append(row);
    });
    section.append(list);
    panel.append(section);
  });
  const engine = el('div', 'gem-engine-card');
  engine.innerHTML =
    '<div class="gem-engine-title">GEM AI ENGINE</div><div class="gem-engine-sub">SCANNING TERRITORY</div><div class="gem-progress"><i></i></div><div class="gem-engine-stats"><b>12,482</b><span>km² analyzed</span><b>8,421</b><span>spectral anomalies</span><b>384</b><span>structural intersections</span><b>67</b><span>high-priority targets</span></div>';
  const run = el('button', 'gem-primary-button', 'RUN INTELLIGENCE ANALYSIS');
  run.type = 'button';
  run.addEventListener('click', () => runAnalysis(run));
  engine.append(run);
  panel.append(engine);
  return panel;
}

function targetPanel() {
  const panel = el('aside', 'gem-target-panel');
  panel.innerHTML = `
    <div class="gem-target-head"><div><span class="gem-panel-kicker">TARGET INTELLIGENCE</span><strong>GEM-004281</strong></div><span class="gem-tier tier-1">TIER 1</span></div>
    <div class="gem-target-location">4.6231° S · 72.1885° W <span>•</span> Elevation 1,245 m</div>
    <div class="gem-target-tabs" role="tablist">
      <button class="is-active" data-tab="overview">Overview</button><button data-tab="spectral">Spectral</button><button data-tab="geology">Geology</button><button data-tab="structure">Structure</button><button data-tab="3d">3D View</button>
    </div>
    <div class="gem-score-wrap"><div class="gem-score-ring"><span>94.7</span><small>/ 100</small></div><div><div class="gem-label">MINERAL INTELLIGENCE SCORE</div><div class="gem-score-bar"><i></i></div><strong class="gem-high">VERY HIGH POTENTIAL</strong></div></div>
    <div class="gem-minerals"><span>Au <b>96%</b></span><span>Cu <b>81%</b></span><span>Mo <b>67%</b></span><span>Ag <b>54%</b></span></div>
    <div class="gem-confidence"><span>CONFIDENCE</span><b>HIGH · 94%</b></div>
    <div class="gem-evidence"><div class="gem-section-title">EVIDENCE CONVERGENCE</div></div>
    <div class="gem-action"><div><span class="gem-section-title">RECOMMENDED ACTION</span><strong>FIELD VALIDATION</strong><small>High-priority target for detailed exploration.</small></div><span class="gem-action-arrow">›</span></div>
    <div class="gem-target-actions"><button data-action="open">OPEN TARGET</button><button data-action="3d">3D ANALYSIS</button><button data-action="report">GENERATE REPORT</button></div>
  `;
  const evidence = [
    ['Spectral signature (EMIT / EnMAP)', 96],
    ['Hydrothermal alteration', 93],
    ['Structural setting', 91],
    ['Geological compatibility', 95],
    ['Sentinel-2 agreement', 97],
    ['Geochemical support', 82],
    ['AI model confidence', 94],
  ];
  const list = panel.querySelector('.gem-evidence');
  evidence.forEach(([label, value]) => {
    const row = el('div', 'gem-evidence-row');
    row.innerHTML = `<span>${label}</span><i><b style="width:${value}%"></b></i><em>${value}%</em>`;
    list.append(row);
  });
  panel.querySelectorAll('.gem-target-tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      panel
        .querySelectorAll('.gem-target-tabs button')
        .forEach((x) => x.classList.remove('is-active'));
      btn.classList.add('is-active');
      document.dispatchEvent(
        new CustomEvent('gem:target-tab', { detail: { tab: btn.dataset.tab } }),
      );
    });
  });
  panel
    .querySelectorAll('.gem-target-actions button')
    .forEach((btn) =>
      btn.addEventListener('click', () => showToast(btn.textContent)),
    );
  return panel;
}

function bottomIntelligence() {
  const wrap = el('section', 'gem-bottom-intelligence');
  wrap.innerHTML = `
    <div class="gem-bottom-card fusion"><div class="gem-section-title">MULTI-SENSOR FUSION</div><div class="gem-fusion-stack"><span>S2</span><span>EMIT</span><span>EnMAP</span><span>GEO</span><span>DEM</span><span>GEO-CHEM</span><b>→</b><strong>GEM AI FUSION ENGINE</strong></div></div>
    <div class="gem-bottom-card spectral"><div class="gem-section-title">SPECTRAL ANALYSIS</div><div class="gem-chart"><i></i><i></i><i></i><i></i><i></i></div><div class="gem-chart-labels"><span>400</span><span>800</span><span>1200</span><span>1600</span><span>2400 nm</span></div><div class="gem-mineral-tags"><span>Kaolinite</span><span>Alunite</span><span>Illite</span><span>Chlorite</span><span>Hematite</span></div></div>
    <div class="gem-bottom-card terrain"><div class="gem-section-title">3D TERRAIN & GEOLOGY</div><div class="gem-terrain-art"><b>GEM-004281</b><span>ALTERATION ZONE</span><i>STRUCTURAL CONTROL</i></div></div>
    <div class="gem-bottom-card priority"><div class="gem-section-title">TARGET PRIORITY</div><div class="gem-priority-row"><b class="p1">●</b><span>TIER 1</span><em>Critical Target</em></div><div class="gem-priority-row"><b class="p2">●</b><span>TIER 2</span><em>High Potential</em></div><div class="gem-priority-row"><b class="p3">●</b><span>TIER 3</span><em>Prospective</em></div><div class="gem-priority-row"><b class="p4">●</b><span>TIER 4</span><em>Background</em></div></div>
  `;
  return wrap;
}

function topHeader() {
  const header = el('header', 'gem-command-header');
  header.innerHTML = `
    <div class="gem-brand"><span class="gem-brand-mark">G</span><div><strong>GEM <small>MINERAL INTELLIGENCE CENTER</small></strong><em>GLOBAL EXPLORATION & MINERAL INTELLIGENCE ENGINE</em></div></div>
    <nav class="gem-main-nav">
      <button class="is-active">◉ <span>GOD'S EYE VIEW</span></button><button>◇ <span>GLOBAL</span></button><button>□ <span>COUNTRY</span></button><button>⌂ <span>REGION</span></button><button>◎ <span>PROSPECT</span></button><button>⊙ <span>TARGET</span></button><button>◇ <span>3D</span></button><button>⌁ <span>AI ANALYSIS</span></button><button>▣ <span>REPORTS</span></button>
    </nav>
    <div class="gem-user"><span class="gem-online"></span><strong>Gio</strong><small>TerraQueen</small><span>⌄</span></div>
  `;
  header.querySelectorAll('.gem-main-nav button').forEach((btn) =>
    btn.addEventListener('click', () => {
      header
        .querySelectorAll('.gem-main-nav button')
        .forEach((x) => x.classList.remove('is-active'));
      btn.classList.add('is-active');
      showToast(btn.textContent.trim());
    }),
  );
  return header;
}

function mapHud() {
  const hud = el('div', 'gem-map-hud');
  hud.innerHTML = `
    <div class="gem-map-search">⌕ <span>Search location, project or coordinates...</span></div>
    <div class="gem-map-modes"><button class="is-active">Satellite</button><button>Topography</button><button>Geology</button><button>Alteration</button><button>Structures</button><button>Mineral Potential</button><button>Infrastructure</button></div>
    <div class="gem-map-meta">ZOOM 10.5 · SCALE 1:250,000 · EPSG:4326 · SENSOR: EMIT L2BMIN · RESOLUTION: 60 m</div>
  `;
  return hud;
}

function showToast(message) {
  let t = document.querySelector('.gem-toast');
  if (!t) {
    t = el('div', 'gem-toast');
    document.body.append(t);
  }
  t.textContent = message;
  t.classList.add('is-visible');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('is-visible'), 1800);
}

function runAnalysis(button) {
  button.disabled = true;
  button.textContent = 'STARTING GEM ANALYSIS…';

  const onState = (event) => {
    const phase = event.detail && event.detail.phase;
    if (phase !== 'ready' && phase !== 'error') return;
    document.removeEventListener('gem:global-intelligence-state', onState);
    button.disabled = false;
    button.textContent =
      phase === 'ready' ? 'ANALYSIS COMPLETE' : 'ANALYSIS FAILED';
    setTimeout(() => (button.textContent = 'RUN INTELLIGENCE ANALYSIS'), 1800);
    showToast(
      phase === 'ready'
        ? 'GEM global mineral intelligence analysis complete'
        : 'GEM global mineral intelligence analysis failed',
    );
  };

  document.addEventListener('gem:global-intelligence-state', onState);
  document.dispatchEvent(new CustomEvent('gem:run-global-analysis'));
}

function forceGemCommandCenter() {
  if (!document.body) return;

  document.documentElement.dataset.product = 'GEM Mineral Intelligence Center';
  document.documentElement.dataset.gemExperience = 'center';

  // The static GEM shell is rendered by scene-chrome.html. Do not create a
  // second fixed full-screen shell here: that duplicate overlay used to sit
  // above the launch panel and capture pointer events in Pinokio.
  document.querySelector('.gem-command-center-force')?.remove();

  const legacy =
    '#first-run-launcher,#loading-screen,#intel-hud,#title-bar,#style-indicator,#left-panel-stack,#right-panel-stack,#right-context-rail,#command-dock,#location-bar,#voice-bar,#top-center-actions,#traffic-sync-chip,#cctv-sync-chip,#safe-frame-overlay';

  document.querySelectorAll(legacy).forEach((node) => {
    node.style.setProperty('display', 'none', 'important');
    node.style.setProperty('visibility', 'hidden', 'important');
    node.style.setProperty('pointer-events', 'none', 'important');
  });
}

export function installMineralIntelligenceCenter() {
  const install = () => {
    forceGemCommandCenter();
    document.body.classList.add('gem-mineral-center');
    document.documentElement.dataset.gemCenterInstalled = 'true';
    // Static scene chrome owns the GEM shell. Runtime mounting remains as a
    // fallback for alternate hosts, but never duplicates the static shell.
    if (!document.querySelector('.gem-command-header')) {
      document.body.append(topHeader());
      document.body.append(mapHud());
      document.body.append(sourcePanel());
      document.body.append(targetPanel());
      document.body.append(bottomIntelligence());
    }
    // GEM now enters directly into the command center. The legacy launch
    // panel is intentionally absent so Pinokio cannot strand the operator
    // behind an unresponsive INITIALIZE GEM screen.
  };
  if (document.body) install();
  else document.addEventListener('DOMContentLoaded', install, { once: true });
}
