import * as Cesium from 'cesium';
import {
  GLOBAL_MINERAL_SOURCES,
  queryMineralSources,
} from './globalMineralSources.js';
import {
  buildEvidenceSummary,
  generateGlobalTargets,
  TARGET_MODEL_ID,
} from './globalTargetEngine.js';
import {
  enrichTargetsWithTrueProspectivity,
  TRUE_PROSPECTIVITY_MODEL_ID,
} from './trueProspectivity.js';

const DATA_SOURCE_NAME = 'GEM Global Mineral Intelligence';
const WORLD_BBOX = Object.freeze({
  west: -180,
  south: -85,
  east: 180,
  north: 85,
});

function radiansToDegrees(value) {
  return (value * 180) / Math.PI;
}

function currentBBox(viewer) {
  const rectangle =
    viewer && viewer.camera && viewer.camera.computeViewRectangle
      ? viewer.camera.computeViewRectangle(
          viewer.scene && viewer.scene.globe
            ? viewer.scene.globe.ellipsoid
            : undefined,
        )
      : null;

  if (!rectangle) return WORLD_BBOX;

  const west = radiansToDegrees(rectangle.west);
  const east = radiansToDegrees(rectangle.east);
  const south = Math.max(-85, radiansToDegrees(rectangle.south));
  const north = Math.min(85, radiansToDegrees(rectangle.north));

  if (![west, east, south, north].every(Number.isFinite)) return WORLD_BBOX;

  if (east < west || east - west > 300) return WORLD_BBOX;

  return {
    west: Math.max(-180, west),
    south,
    east: Math.min(180, east),
    north,
  };
}

function bboxKey(bbox) {
  return [bbox.west, bbox.south, bbox.east, bbox.north]
    .map((value) => Number(value).toFixed(3))
    .join(',');
}

function tierClass(tier) {
  return String(tier || 'TIER 4')
    .toLowerCase()
    .replaceAll(' ', '-');
}

function tierColor(tier) {
  switch (tier) {
    case 'TIER 1':
      return '#ff4a3d';
    case 'TIER 2':
      return '#ff9f43';
    case 'TIER 3':
      return '#f0d45a';
    default:
      return '#70a0b0';
  }
}

function appendText(element, value) {
  element.textContent = value == null || value === '' ? '—' : String(value);
  return element;
}

function createPanel() {
  const panel = document.createElement('aside');
  panel.className = 'gem-global-intel-panel';
  panel.innerHTML = [
    '<div class="gem-global-intel-head">',
    '  <div><span>GLOBAL MINERAL INTELLIGENCE</span><strong>TARGET GENERATION ENGINE</strong></div>',
    '  <i data-role="status-dot" class="gem-global-status-dot"></i>',
    '</div>',
    '<div class="gem-global-intel-model">',
    '  <span>MODEL</span><b data-role="model"></b>',
    '  <span>MODE</span><b data-role="mode">TRUE MULTISOURCE</b>',
    '</div>',
    '<div data-role="source-status" class="gem-global-source-status"></div>',
    '<div data-role="evidence-status" class="gem-global-evidence-status"></div>',
    '<div data-role="metrics" class="gem-global-metrics">',
    '  <div><b data-metric="features">0</b><span>reference records</span></div>',
    '  <div><b data-metric="targets">0</b><span>targets generated</span></div>',
    '  <div><b data-metric="tier1">0</b><span>tier 1 targets</span></div>',
    '  <div><b data-metric="top">0.0</b><span>top score / 100</span></div>',
    '  <div><b data-metric="coverage">0.0%</b><span>evidence coverage</span></div>',
    '</div>',
    '<div class="gem-global-top-targets">',
    '  <div class="gem-global-section-title">TOP TARGETS</div>',
    '  <div data-role="targets" class="gem-global-target-list"></div>',
    '</div>',
    '<div class="gem-global-actions">',
    '  <button type="button" data-action="scan">SCAN CURRENT VIEW</button>',
    '  <button type="button" data-action="world">GLOBAL SCAN</button>',
    '</div>',
    '<div data-role="note" class="gem-global-note"></div>',
  ].join('');
  appendText(
    panel.querySelector('[data-role="model"]'),
    TRUE_PROSPECTIVITY_MODEL_ID,
  );
  return panel;
}

function renderEvidenceStatus(panel, providerStatuses) {
  const host = panel.querySelector('[data-role="evidence-status"]');
  host.replaceChildren();

  const entries = Object.values(providerStatuses || {});
  for (const status of entries) {
    const row = document.createElement('div');
    row.className =
      'gem-global-source-row ' + (status.ok ? 'is-ok' : 'is-error');

    const dot = document.createElement('i');
    const name = document.createElement('span');
    const state = document.createElement('b');

    name.textContent = status.sourceName || status.sourceId || 'Evidence source';
    state.textContent = status.ok ? 'READY' : 'OFF';

    row.append(dot, name, state);
    host.append(row);
  }
}

function renderSourceStatus(panel, statuses) {
  const host = panel.querySelector('[data-role="source-status"]');
  host.replaceChildren();

  for (const status of statuses) {
    const row = document.createElement('div');
    row.className =
      'gem-global-source-row ' + (status.ok ? 'is-ok' : 'is-error');

    const dot = document.createElement('i');
    const name = document.createElement('span');
    const count = document.createElement('b');

    name.textContent =
      status.source && status.source.name
        ? status.source.name
        : 'Unknown source';
    count.textContent = status.ok
      ? Number(status.count || 0).toLocaleString()
      : 'OFF';

    row.append(dot, name, count);
    host.append(row);
  }
}

function renderTargets(panel, targets) {
  const host = panel.querySelector('[data-role="targets"]');
  host.replaceChildren();

  if (!targets.length) {
    const empty = document.createElement('div');
    empty.className = 'gem-global-empty';
    empty.textContent = 'No reference targets in this view.';
    host.append(empty);
    return;
  }

  for (const target of targets.slice(0, 8)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gem-global-target-row ' + tierClass(target.tier);
    button.dataset.targetId = target.id;

    const dot = document.createElement('span');
    dot.className = 'gem-global-tier-dot';
    dot.style.setProperty('--tier-color', tierColor(target.tier));

    const id = document.createElement('b');
    id.textContent = target.id;

    const score = document.createElement('strong');
    score.textContent = Number(target.score || 0).toFixed(1);

    const detail = document.createElement('small');
    detail.textContent =
      target.commodities && target.commodities.length
        ? target.commodities.join(' · ')
        : 'Documented mineral evidence';

    button.append(dot, id, score, detail);
    host.append(button);
  }
}

function updatePanel(
  panel,
  summary,
  statuses,
  targets,
  phase,
  providerStatuses = {},
) {
  panel
    .querySelector('[data-role="status-dot"]')
    .classList.toggle('is-busy', phase === 'scanning');
  panel
    .querySelector('[data-role="status-dot"]')
    .classList.toggle(
      'is-error',
      statuses.length > 0 && statuses.every((status) => !status.ok),
    );

  renderSourceStatus(panel, statuses);
  renderEvidenceStatus(panel, providerStatuses);

  appendText(
    panel.querySelector('[data-metric="features"]'),
    Number(summary.referenceFeatures || 0).toLocaleString(),
  );
  appendText(
    panel.querySelector('[data-metric="targets"]'),
    Number(summary.targetCount || 0).toLocaleString(),
  );
  appendText(
    panel.querySelector('[data-metric="tier1"]'),
    Number(summary.tier1 || 0).toLocaleString(),
  );
  appendText(
    panel.querySelector('[data-metric="top"]'),
    Number(summary.topScore || 0).toFixed(1),
  );
  appendText(
    panel.querySelector('[data-metric="coverage"]'),
    Number(summary.evidenceCoverage || 0).toFixed(1) + '%',
  );

  renderTargets(panel, targets);

  const note = panel.querySelector('[data-role="note"]');
  note.textContent =
    phase === 'scanning'
      ? 'Acquiring public mineral reference data…'
      : phase === 'error'
        ? 'Source acquisition failed. Review source status and retry.'
        : 'Reference-data ranking only. Add geology, geophysics, geochemistry and spectral evidence before field decisions.';
}

function addReferencePoint(dataSource, feature) {
  const coordinates = feature.geometry.coordinates;
  const properties = feature.properties || {};
  const sourceIsCritical = properties.sourceId === 'usgs-critical-minerals';

  dataSource.entities.add({
    id:
      'gem-ref-' +
      String(properties.sourceId || 'unknown') +
      '-' +
      String(properties.name || 'unnamed') +
      '-' +
      String(coordinates[0]) +
      '-' +
      String(coordinates[1]),
    position: Cesium.Cartesian3.fromDegrees(coordinates[0], coordinates[1]),
    point: {
      pixelSize: sourceIsCritical ? 7 : 4,
      color: Cesium.Color.fromCssColorString(
        sourceIsCritical ? '#f2b84b' : '#40ddeb',
      ),
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 1,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    properties: {
      source: properties.sourceName || '',
      name: properties.name || '',
      mineral: properties.mineral || '',
      depositType: properties.depositType || '',
      status: properties.status || '',
      sourceId: properties.sourceId || '',
    },
  });
}

function addTarget(dataSource, target) {
  const color = Cesium.Color.fromCssColorString(tierColor(target.tier));

  dataSource.entities.add({
    id: 'gem-target-' + target.id,
    position: Cesium.Cartesian3.fromDegrees(target.longitude, target.latitude),
    ellipse: {
      semiMajorAxis: Math.max(
        900,
        Number(target.nearestReferenceKm || 0) * 500,
      ),
      semiMinorAxis: Math.max(
        650,
        Number(target.nearestReferenceKm || 0) * 320,
      ),
      material: new Cesium.ColorMaterialProperty(color.withAlpha(0.14)),
      outline: true,
      outlineColor: color.withAlpha(0.92),
      outlineWidth: 2,
      height: 0,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      extrudedHeight: 180,
      extrudedHeightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    },
    label: {
      text: target.id + ' · ' + Number(target.score || 0).toFixed(1),
      font: '10px JetBrains Mono',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(0, -20),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    properties: {
      tier: target.tier || '',
      score: Number(target.score || 0),
      model: target.modelId || '',
      referenceModel: target.referenceModelId || '',
      coverage:
        target.trueProspectivity && target.trueProspectivity.coverage != null
          ? target.trueProspectivity.coverage
          : null,
      channels:
        target.trueProspectivity &&
        target.trueProspectivity.channels
          ? JSON.stringify(target.trueProspectivity.channels)
          : '',
      interpretation:
        target.trueProspectivity &&
        target.trueProspectivity.interpretation
          ? target.trueProspectivity.interpretation
          : target.interpretation || '',
      commodities: (target.commodities || []).join(', '),
    },
  });
}

export function createGlobalMineralIntelligence({
  viewer,
  fetchImpl = globalThis.fetch,
  autoScan = true,
  debounceMs = 1800,
  viewportPages = 1,
  globalPages = 6,
} = {}) {
  if (!viewer) throw new TypeError('A Cesium viewer is required');

  const panel = createPanel();
  const dataSource = new Cesium.CustomDataSource(DATA_SOURCE_NAME);

  let destroyed = false;
  const scanController = new AbortController();
  let scanTimer = null;
  let scanPromise = null;
  let lastCameraKey = null;

  let state = {
    phase: 'idle',
    bbox: WORLD_BBOX,
    features: [],
    targets: [],
    summary: buildEvidenceSummary([], []),
    statuses: [],
    providerStatuses: {},
    reason: 'initial',
    updatedAt: null,
  };

  function publish(nextState) {
    state = nextState;
    document.dispatchEvent(
      new CustomEvent('gem:global-intelligence-state', {
        detail: Object.freeze({
          phase: state.phase,
          bbox: state.bbox,
          summary: state.summary,
          statuses: state.statuses,
          providerStatuses: state.providerStatuses,
          targets: state.targets,
        }),
      }),
    );
  }

  async function scan(bbox, reason) {
    if (destroyed) return state;
    if (scanPromise) return scanPromise;

    const queryBox = bbox || WORLD_BBOX;
    const isGlobal = reason === 'global';
    const cameraKey = bboxKey(queryBox);

    if (reason === 'camera' && cameraKey === lastCameraKey) return state;

    if (reason === 'camera') lastCameraKey = cameraKey;

    scanPromise = (async () => {
      panel.classList.add('is-busy');

      const scanningState = {
        ...state,
        phase: 'scanning',
        bbox: queryBox,
        reason: reason || 'manual',
      };
      updatePanel(
        panel,
        scanningState.summary,
        scanningState.statuses,
        scanningState.targets,
        'scanning',
      );
      publish(scanningState);

      const results = await queryMineralSources(queryBox, {
        fetchImpl,
        signal: scanController.signal,
        sources: [
          GLOBAL_MINERAL_SOURCES.mrds,
          GLOBAL_MINERAL_SOURCES.criticalMinerals,
        ],
        maxPages: isGlobal ? globalPages : viewportPages,
      });

      const features = results.flatMap((result) => result.features);
      const referenceTargets = generateGlobalTargets(features, queryBox, {
        topN: isGlobal ? 64 : 32,
      });
      const enrichment = await enrichTargetsWithTrueProspectivity(
        referenceTargets,
        { fetchImpl, signal: scanController.signal },
      );
      const targets = enrichment.targets.length
        ? enrichment.targets
        : referenceTargets.map((target) => ({
            ...target,
            modelId: TARGET_MODEL_ID,
          }));
      const summary = {
        ...buildEvidenceSummary(features, targets),
        modelId: TRUE_PROSPECTIVITY_MODEL_ID,
      };
      const statuses = results.map((result) => ({
        source: result.source,
        ok: result.ok,
        count: result.count,
        durationMs: result.durationMs,
        error: result.error || null,
      }));

      dataSource.entities.removeAll();

      for (const feature of features.slice(0, 3000))
        addReferencePoint(dataSource, feature);
      for (const target of targets) addTarget(dataSource, target);

      const nextState = {
        phase: 'ready',
        bbox: queryBox,
        features,
        targets,
        summary,
        statuses,
        providerStatuses: enrichment.providerStatuses,
        reason: reason || 'manual',
        updatedAt: new Date().toISOString(),
      };

      updatePanel(
        panel,
        summary,
        statuses,
        targets,
        'ready',
        enrichment.providerStatuses,
      );
      publish(nextState);
      viewer.scene && viewer.scene.requestRender
        ? viewer.scene.requestRender()
        : null;

      return nextState;
    })()
      .catch((error) => {
        const nextState = {
          ...state,
          phase: 'error',
          error,
          updatedAt: new Date().toISOString(),
        };
        updatePanel(
          panel,
          nextState.summary,
          nextState.statuses,
          nextState.targets,
          'error',
          nextState.providerStatuses,
        );
        publish(nextState);
        return nextState;
      })
      .finally(() => {
        panel.classList.remove('is-busy');
        scanPromise = null;
      });

    return scanPromise;
  }

  function scheduleCameraScan() {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      scanTimer = null;
      scan(currentBBox(viewer), 'camera');
    }, debounceMs);
  }

  function onCameraChanged() {
    scheduleCameraScan();
  }

  function onRunAnalysis() {
    scan(currentBBox(viewer), 'manual');
  }

  function mount() {
    if (destroyed) return api;
    document.body.append(panel);
    viewer.dataSources.add(dataSource);

    panel
      .querySelector('[data-action="scan"]')
      .addEventListener('click', () => scan(currentBBox(viewer), 'manual'));

    panel
      .querySelector('[data-action="world"]')
      .addEventListener('click', () => scan(WORLD_BBOX, 'global'));

    panel
      .querySelector('[data-role="targets"]')
      .addEventListener('click', (event) => {
        const button = event.target.closest('[data-target-id]');
        if (!button) return;
        const target = state.targets.find(
          (entry) => entry.id === button.dataset.targetId,
        );
        if (!target) return;

        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            target.longitude,
            target.latitude,
            Math.max(25000, Number(target.nearestReferenceKm || 0) * 1200),
          ),
          duration: 1.8,
        });

        document.dispatchEvent(
          new CustomEvent('gem:target-selected', {
            detail: Object.freeze({ ...target }),
          }),
        );
      });

    if (viewer.camera && viewer.camera.moveEnd)
      viewer.camera.moveEnd.addEventListener(onCameraChanged);
    document.addEventListener('gem:run-global-analysis', onRunAnalysis);

    updatePanel(
      panel,
      state.summary,
      state.statuses,
      state.targets,
      'idle',
      state.providerStatuses,
    );

    if (autoScan) scan(currentBBox(viewer), 'startup');

    return api;
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;

    if (scanTimer) clearTimeout(scanTimer);
    scanController.abort();
    if (viewer.camera && viewer.camera.moveEnd)
      viewer.camera.moveEnd.removeEventListener(onCameraChanged);
    document.removeEventListener('gem:run-global-analysis', onRunAnalysis);

    viewer.dataSources.remove(dataSource, true);
    panel.remove();
  }

  const api = Object.freeze({
    mount,
    scan,
    destroy,
    getState: () => state,
    getWorldBbox: () => WORLD_BBOX,
    sources: GLOBAL_MINERAL_SOURCES,
    configuration: Object.freeze({
      modelId: TRUE_PROSPECTIVITY_MODEL_ID,
      referenceModelId: TARGET_MODEL_ID,
      viewportPages,
      globalPages,
    }),
  });

  return api;
}
