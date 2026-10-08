import * as Cesium from 'cesium';
import { polygonsContain } from '../data/adminBoundaries.js';
import {
  MINERAL_SEARCH_CATALOG,
  attachRequestedCommodity,
  filterMineralFeatures,
  filterTargetsToCountry,
  listMineralSearchCountries,
  mineralLabel,
  resolveMineralSearch,
} from './globalMineralSearch.js';
import {
  EARTHRISE_MINING_SOURCE,
  earthriseMiningEvidence,
  fetchEarthriseDetections,
} from './earthriseMiningDetector.js';
import { summarizeTriage, triageTargets } from './miningOpportunity.js';
import {
  GLOBAL_MINERAL_SOURCES,
  queryMineralSources,
} from './globalMineralSources.js';
import {
  buildEvidenceSummary,
  generateGlobalTargets,
  generateProspectivityCandidates,
  TARGET_MODEL_ID,
} from './globalTargetEngine.js';
import {
  enrichTargetsWithTrueProspectivity,
  TRUE_PROSPECTIVITY_MODEL_ID,
} from './trueProspectivity.js';
import {
  buildInvestmentProfile,
  buildPortfolioSnapshot,
} from './investmentIntelligence.js';

const DATA_SOURCE_NAME = 'GEM Global Mineral Intelligence';
const WORLD_BBOX = Object.freeze({
  west: -180,
  south: -85,
  east: 180,
  north: 85,
});

function mineralSelectLabel(key) {
  const entry = MINERAL_SEARCH_CATALOG.find(
    (candidate) => candidate.key === key,
  );
  return entry ? entry.label : mineralLabel('');
}

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
    '<div class="gem-global-section-title gem-global-evidence-title">MULTISOURCE EVIDENCE</div>',
    '<div data-role="evidence-status" class="gem-global-evidence-status"></div>',
    '<div data-role="metrics" class="gem-global-metrics">',
    '  <div><b data-metric="features">0</b><span>reference records</span></div>',
    '  <div><b data-metric="candidates">0</b><span>candidate cells evaluated</span></div>',
    '  <div><b data-metric="targets">0</b><span>targets generated</span></div>',
    '  <div><b data-metric="tier1">0</b><span>tier 1 targets</span></div>',
    '  <div><b data-metric="top">0.0</b><span>top score / 100</span></div>',
    '  <div><b data-metric="coverage">0.0%</b><span>evidence coverage</span></div>',\n    '  <div><b data-metric="readiness">0.0</b><span>investment readiness</span></div>',
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

  const search = document.createElement('section');
  search.className = 'gem-global-search';
  search.innerHTML = [
    '<div class="gem-global-section-title">GLOBAL MINERAL SEARCH</div>',
    '<label><span>COUNTRY</span><select data-search-country><option value="">GLOBAL · ALL COUNTRIES</option></select></label>',
    '<label><span>MINERAL / METAL</span><select data-search-mineral></select></label>',
    '<div class="gem-global-search-actions">',
    '  <button type="button" data-action="search">RUN SEARCH</button>',
    '  <button type="button" data-action="clear">CLEAR</button>',
    '</div>',
    '<div class="gem-global-search-status" data-role="search-status">GLOBAL · ALL MINERALS / METALS</div>',
  ].join('');
  const mineralSelect = search.querySelector('[data-search-mineral]');
  for (const entry of MINERAL_SEARCH_CATALOG) {
    const option = document.createElement('option');
    option.value = entry.key;
    option.textContent = entry.label;
    mineralSelect.append(option);
  }
  panel.insertBefore(
    search,
    panel.querySelector('[data-role="source-status"]'),
  );
  return panel;
}

function renderEvidenceStatus(panel, providerStatuses) {
  const host = panel.querySelector('[data-role="evidence-status"]');
  host.replaceChildren();

  const entries = Object.values(providerStatuses || {});
  for (const status of entries) {
    const row = document.createElement('div');
    const available = Boolean(status.ok);
    const discovered = Number(status.discovered || 0) > 0;
    row.className =
      'gem-global-source-row ' +
      (available ? 'is-ok' : discovered ? 'is-warning' : 'is-error');

    const dot = document.createElement('i');
    const name = document.createElement('span');
    const state = document.createElement('b');

    name.textContent =
      status.sourceName || status.sourceId || 'Evidence source';
    state.textContent = available ? 'READY' : discovered ? 'FOUND' : 'OFF';

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

function renderOperationalTriage(panel, targets) {
  const summary = summarizeTriage(targets);
  for (const [key, value] of Object.entries(summary)) {
    const node = panel.querySelector('[data-ops="' + key + '"]');
    if (node) node.textContent = Number(value || 0).toLocaleString();
  }
}

function renderTargets(panel, targets) {
  const host = panel.querySelector('[data-role="targets"]');
  host.replaceChildren();

  if (!targets.length) {
    const empty = document.createElement('div');
    empty.className = 'gem-global-empty';
    empty.textContent = 'No prospectivity targets in this view.';
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
    const triage = target.operationalTriage || {};
    const geochemCommodity =
      target.trueProspectivity &&
      target.trueProspectivity.diagnostics &&
      target.trueProspectivity.diagnostics.geochemistry &&
      target.trueProspectivity.diagnostics.geochemistry.commodity;
    const emitMinerals =
      target.trueProspectivity &&
      target.trueProspectivity.diagnostics &&
      target.trueProspectivity.diagnostics.spectral &&
      target.trueProspectivity.diagnostics.spectral.emit &&
      Array.isArray(
        target.trueProspectivity.diagnostics.spectral.emit.mineralNames,
      )
        ? target.trueProspectivity.diagnostics.spectral.emit.mineralNames.slice(
            0,
            2,
          )
        : [];
    const labels =
      target.commodities && target.commodities.length
        ? target.commodities
        : geochemCommodity
          ? [geochemCommodity]
          : emitMinerals;
    const activityLabel = triage.classification || 'MULTISOURCE PROSPECTIVITY';
    detail.textContent =
      activityLabel + (labels.length ? ' · ' + labels.join(' · ') : '');

    button.append(dot, id, score, detail);
    host.append(button);
  }
}

function renderMiningActivity(panel, miningState) {
  const host = panel.querySelector('[data-role="mining-activity"]');
  if (!host) return;
  host.replaceChildren();
  const state = miningState || {};
  const makeRow = (label, value) => {
    const row = document.createElement('div');
    const l = document.createElement('span');
    const v = document.createElement('b');
    l.textContent = label;
    v.textContent = value;
    row.append(l, v);
    host.append(row);
  };
  if (state.phase === 'loading') {
    makeRow('SOURCE', 'LOADING');
    return;
  }
  makeRow('SOURCE', state.ok ? 'READY' : 'OFF');
  makeRow('DETECTIONS', Number(state.detectionCount || 0).toLocaleString());
  makeRow('CONFIRMED', Number(state.confirmedCount || 0).toLocaleString());
  makeRow(
    'NEAREST',
    state.nearestDistanceKm == null
      ? '—'
      : state.nearestDistanceKm.toFixed(1) + ' km',
  );
  makeRow('MODEL', state.model || EARTHRISE_MINING_SOURCE.model);
}

function updatePanel(
  panel,
  summary,
  statuses,
  targets,
  phase,
  providerStatuses = {},
  miningState = {},
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
  renderMiningActivity(panel, miningState);

  appendText(
    panel.querySelector('[data-metric="features"]'),
    Number(summary.referenceFeatures || 0).toLocaleString(),
  );
  appendText(
    panel.querySelector('[data-metric="candidates"]'),
    Number(summary.candidateCount || 0).toLocaleString(),
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
  );\n  appendText(\n    panel.querySelector('[data-metric="readiness"]'),\n    Number(summary.investmentReadiness || 0).toFixed(1),\n  );

  renderOperationalTriage(panel, targets);
  renderTargets(panel, targets);

  const note = panel.querySelector('[data-role="note"]');
  note.textContent =
    phase === 'scanning'
      ? 'Acquiring public mineral reference data…'
      : phase === 'error'
        ? 'Source acquisition failed. Review source status and retry.'
        : 'Discovery Engine: reference + geology + magnetics/structure + real geochemistry + Sentinel-2/EnMAP spectral evidence. EMIT L2BMIN activates at pixel level when authenticated Earthdata access is available.';
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

  const gridKm = Number(target.gridCellSize || 0) * 111.32 * 0.35;
  const referenceKm = Number(target.nearestReferenceKm || 0);
  const zoneKm = Math.max(
    0.9,
    referenceKm > 0
      ? Math.min(referenceKm * 0.5, gridKm || referenceKm * 0.5)
      : gridKm,
  );

  dataSource.entities.add({
    id: 'gem-target-' + target.id,
    position: Cesium.Cartesian3.fromDegrees(target.longitude, target.latitude),
    ellipse: {
      semiMajorAxis: zoneKm * 1000,
      semiMinorAxis: Math.max(0.65, zoneKm * 0.72) * 1000,
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
        target.trueProspectivity && target.trueProspectivity.channels
          ? JSON.stringify(target.trueProspectivity.channels)
          : '',
      interpretation:
        target.trueProspectivity && target.trueProspectivity.interpretation
          ? target.trueProspectivity.interpretation
          : target.interpretation || '',
      commodities: (target.commodities || []).join(', '),
      operationalClass:
        target.operationalTriage && target.operationalTriage.classification
          ? target.operationalTriage.classification
          : '',
      discoveryOpportunityScore:
        target.operationalTriage &&
        target.operationalTriage.discoveryOpportunityScore != null
          ? target.operationalTriage.discoveryOpportunityScore
          : null,
      miningActivityScore:
        target.operationalTriage &&
        target.operationalTriage.miningActivityScore != null
          ? target.operationalTriage.miningActivityScore
          : null,
    },
  });
}

export function createGlobalMineralIntelligence({
  viewer,
  fetchImpl = globalThis.fetch,
  autoScan = true,
  emitSampler,
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
  const scanCache = new Map();
  const SCAN_CACHE_TTL_MS = 60_000;

  let state = {
    phase: 'idle',
    bbox: WORLD_BBOX,
    features: [],
    targets: [],
    summary: buildEvidenceSummary([], []),
    statuses: [],
    providerStatuses: {},
    miningState: {
      phase: 'idle',
      ok: false,
      source: EARTHRISE_MINING_SOURCE.id,
    },
    reason: 'initial',
    updatedAt: null,
    search: {
      country: '',
      countryName: 'GLOBAL',
      mineralKey: '',
      mineralLabel: mineralLabel(''),
      active: false,
      area: null,
    },
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
          miningState: state.miningState,
          targets: state.targets,
          search: state.search,
        }),
      }),
    );
  }

  async function scan(bbox, reason, searchContext = state.search) {
    if (destroyed) return state;
    if (scanPromise) return scanPromise;

    const queryBox = bbox || WORLD_BBOX;
    const search = searchContext || state.search;
    const isGlobal = reason === 'global';
    const cameraKey = bboxKey(queryBox);

    if (reason === 'camera' && cameraKey === lastCameraKey) return state;

    if (reason === 'camera') lastCameraKey = cameraKey;

    const cacheKey = [
      cameraKey,
      reason === 'global' ? 'global' : 'viewport',
      search.country || '',
      search.mineralKey || '',
    ].join('|');
    const cached = scanCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < SCAN_CACHE_TTL_MS) {
      const cachedState = {
        ...cached.state,
        reason: 'cache',
        updatedAt: new Date().toISOString(),
      };
      updatePanel(
        panel,
        cachedState.summary,
        cachedState.statuses,
        cachedState.targets,
        'ready',
        cachedState.providerStatuses,
        cachedState.miningState,
      );
      publish(cachedState);
      return cachedState;
    }

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

      const miningPromise = fetchEarthriseDetections({
        fetchImpl,
        signal: scanController.signal,
      }).catch((error) => ({
        source: EARTHRISE_MINING_SOURCE,
        detections: [],
        ok: false,
        error,
      }));
      const rawFeatures = results.flatMap((result) => result.features);
      const countryFeatures = search.area
        ? rawFeatures.filter((feature) =>
            polygonsContain(
              search.area.polygons,
              Number(feature.geometry.coordinates[1]),
              Number(feature.geometry.coordinates[0]),
            ),
          )
        : rawFeatures;
      const features = filterMineralFeatures(
        countryFeatures,
        search.mineralKey,
      );
      let candidateTargets = generateProspectivityCandidates(
        features,
        queryBox,
        {
          maxCells: isGlobal ? 2048 : 512,
        },
      );
      if (search.area)
        candidateTargets = filterTargetsToCountry(
          candidateTargets,
          search.area,
        );
      candidateTargets = candidateTargets.map((target) =>
        attachRequestedCommodity(target, search.mineralKey),
      );
      const earthrise = await miningPromise;
      // FAST-FIRST: publish lightweight candidates before deep evidence finishes.
      const fastTargets = candidateTargets
        .slice().sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
        .slice(0, isGlobal ? 24 : 12)
        .map((target) => ({ ...target, provisional: true, decisionStage: 'CANDIDATE_READY' }));
      const fastSummary = {
        ...buildEvidenceSummary(features, fastTargets),
        candidateCount: candidateTargets.length,
        modelId: TARGET_MODEL_ID,
        processingStage: 'CANDIDATE_READY',
        investmentReadiness: 0,
        investmentIntelligence: buildPortfolioSnapshot(fastTargets),
      };
      const fastState = { ...scanningState, phase: 'candidate-ready', bbox: queryBox, features, targets: fastTargets, summary: fastSummary,
        statuses: results.map((result) => ({ source: result.source, ok: result.ok, count: result.count, durationMs: result.durationMs, error: result.error || null })),
        reason: reason || 'manual', updatedAt: new Date().toISOString(), };
      dataSource.entities.removeAll();
      for (const feature of features.slice(0, 3000)) addReferencePoint(dataSource, feature);
      if (search.area) addCountryBoundary(dataSource, search.area);
      for (const target of fastTargets) addTarget(dataSource, target);
      updatePanel(panel, fastSummary, fastState.statuses, fastTargets, 'scanning');
      publish(fastState);
      if (viewer.scene && viewer.scene.requestRender) viewer.scene.requestRender();
      const activityTargets = candidateTargets.map((target) => ({
        target,
        evidence: earthrise.ok
          ? earthriseMiningEvidence(target, earthrise.detections)
          : null,
      }));
      for (const entry of activityTargets) {
        if (!entry.evidence) continue;
        entry.target.miningActivityEvidence = entry.evidence;
      }
      // Keep the planetary candidate field broad, but only enrich the
      // strongest candidates. Expensive raster/spectral/geochemical calls
      // must never scale with the full candidate grid.
      const enrichmentLimit = isGlobal ? 48 : 24;
      const enrichmentCandidates = candidateTargets
        .slice()
        .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
        .slice(0, enrichmentLimit);

      const enrichment = await enrichTargetsWithTrueProspectivity(
        enrichmentCandidates,
        {
          fetchImpl,
          signal: scanController.signal,
          maxGeologyTargets: isGlobal ? 32 : 16,
          emitSampler,
        },
      );
      if (destroyed || scanController.signal.aborted) return state;
      const referenceTargets = generateGlobalTargets(features, queryBox, {
        topN: isGlobal ? 64 : 32,
      });
      const enrichedTargets = search.area
        ? filterTargetsToCountry(enrichment.targets, search.area)
        : enrichment.targets;
      const targets =
        enrichedTargets.length > 0
          ? enrichedTargets
              .filter((target) => target.tier !== 'EXCLUDED')
              .slice(0, isGlobal ? 64 : 32)
          : referenceTargets.map((target) =>
              attachRequestedCommodity(
                {
                  ...target,
                  modelId: TARGET_MODEL_ID,
                },
                search.mineralKey,
              ),
            );
      const triagedTargets = triageTargets(targets);
      const triageSummary = summarizeTriage(triagedTargets);
      const portfolioSnapshot = buildPortfolioSnapshot(triagedTargets);
      const summary = {
        ...buildEvidenceSummary(features, triagedTargets),
        candidateCount: candidateTargets.length,
        modelId: TRUE_PROSPECTIVITY_MODEL_ID,
        operationalTriage: triageSummary,
        investmentReadiness: portfolioSnapshot.averageReadiness,
        investmentIntelligence: portfolioSnapshot,
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
      if (search.area) addCountryBoundary(dataSource, search.area);
      for (const target of triagedTargets) addTarget(dataSource, target);
      const nextState = {
        phase: 'decision-ready',
        bbox: queryBox,
        features,
        targets: triagedTargets,
        summary: { ...summary, processingStage: 'DECISION_READY' },
        statuses,
        providerStatuses: enrichment.providerStatuses,
        miningState: {
          phase: earthrise.ok ? 'ready' : 'error',
          ok: earthrise.ok,
          source: EARTHRISE_MINING_SOURCE.id,
          model: EARTHRISE_MINING_SOURCE.model,
          detectionCount: earthrise.detections.length,
          confirmedCount: earthrise.detections.filter(
            (entry) => entry.confirmed,
          ).length,
        },
        reason: reason || 'manual',
        updatedAt: new Date().toISOString(),
        search,
      };

      updatePanel(
        panel,
        summary,
        statuses,
        triagedTargets,
        'ready',
        enrichment.providerStatuses,
        nextState.miningState,
      );
      publish(nextState);
      scanCache.set(cacheKey, { cachedAt: Date.now(), state: nextState });
      // Bound the in-memory cache so long-running sessions remain lightweight.
      if (scanCache.size > 12) {
        const oldestKey = scanCache.keys().next().value;
        scanCache.delete(oldestKey);
      }
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
    if (state.search && state.search.active) return;
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

    const searchCountry = panel.querySelector('[data-search-country]');
    const searchMineral = panel.querySelector('[data-search-mineral]');
    const searchStatus = panel.querySelector('[data-role="search-status"]');

    const populateCountries = async () => {
      try {
        const countries = await listMineralSearchCountries();
        for (const country of countries) {
          if (!country.name || !country.iso2) continue;
          const option = document.createElement('option');
          option.value = country.name;
          option.textContent = country.name;
          searchCountry.append(option);
        }
      } catch (error) {
        console.warn('[GEM] Country selector failed:', error);
      }
    };

    const updateSearchStatus = (search) => {
      if (!searchStatus) return;
      searchStatus.textContent =
        String(search.countryName || 'GLOBAL').toUpperCase() +
        ' · ' +
        String(search.mineralLabel || mineralLabel('')).toUpperCase();
    };

    const runSearch = async () => {
      const countryName = searchCountry?.value || '';
      const mineralKey = searchMineral?.value || '';
      try {
        const resolved = await resolveMineralSearch({
          country: countryName,
          mineral: mineralKey,
          near: (() => {
            const carto = viewer.camera.positionCartographic;
            return {
              lat: radiansToDegrees(carto.latitude),
              lon: radiansToDegrees(carto.longitude),
            };
          })(),
        });
        const nextSearch = {
          country: countryName,
          countryName: resolved.countryName,
          mineralKey: resolved.mineralKey,
          mineralLabel: resolved.mineralLabel,
          active: Boolean(countryName || mineralKey),
          area: resolved.country,
          bbox: resolved.bbox,
        };
        state = { ...state, search: nextSearch };
        updateSearchStatus(nextSearch);
        if (resolved.country) {
          const [west, south, east, north] = resolved.country.bbox;
          viewer.camera.flyTo({
            destination: Cesium.Rectangle.fromDegrees(
              Math.max(-180, west),
              Math.max(-85, south),
              Math.min(180, east),
              Math.min(85, north),
            ),
            duration: 1.8,
          });
        }
        await scan(resolved.bbox, 'search', nextSearch);
      } catch (error) {
        console.error('[GEM] Mineral search failed:', error);
        if (searchStatus)
          searchStatus.textContent = 'SEARCH ERROR · ' + error.message;
      }
    };

    const clearSearch = async () => {
      searchCountry.value = '';
      searchMineral.value = '';
      const cleared = {
        country: '',
        countryName: 'GLOBAL',
        mineralKey: '',
        mineralLabel: mineralLabel(''),
        active: false,
        area: null,
      };
      state = { ...state, search: cleared };
      updateSearchStatus(cleared);
      await scan(WORLD_BBOX, 'global', cleared);
    };

    panel
      .querySelector('[data-action="search"]')
      .addEventListener('click', runSearch);
    panel
      .querySelector('[data-action="clear"]')
      .addEventListener('click', clearSearch);
    searchCountry?.addEventListener('change', () => {
      if (searchStatus)
        searchStatus.textContent =
          'READY · ' + searchCountry.value.toUpperCase();
    });
    searchMineral?.addEventListener('change', () => {
      if (searchStatus)
        searchStatus.textContent =
          (searchCountry.value || 'GLOBAL').toUpperCase() +
          ' · ' +
          (
            mineralSelectLabel(searchMineral.value) || mineralLabel('')
          ).toUpperCase();
    });
    populateCountries();
    panel
      .querySelector('[data-action="scan"]')
      .addEventListener('click', () => scan(currentBBox(viewer), 'manual'));

    panel
      .querySelector('[data-action="world"]')
      .addEventListener('click', async () => {
        const globalSearch = {
          ...state.search,
          country: '',
          countryName: 'GLOBAL',
          area: null,
          bbox: WORLD_BBOX,
          active: Boolean(state.search?.mineralKey),
        };
        searchCountry.value = '';
        updateSearchStatus(globalSearch);
        state = { ...state, search: globalSearch };
        await scan(WORLD_BBOX, 'global', globalSearch);
      });

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

  function addCountryBoundary(dataSource, area) {
    if (!area || !Array.isArray(area.polygons)) return;
    const rings = area.polygons
      .map((polygon) => polygon && polygon[0])
      .filter((ring) => Array.isArray(ring) && ring.length >= 2);
    rings.forEach((ring, index) => {
      const values = [];
      for (const pair of ring) values.push(Number(pair[0]), Number(pair[1]));
      dataSource.entities.add({
        id:
          'gem-country-boundary-' +
          String(index) +
          '-' +
          String(area.id || area.name || 'country'),
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(values),
          width: 2,
          material: Cesium.Color.fromCssColorString('#f2bd55').withAlpha(0.92),
          clampToGround: true,
        },
      });
    });
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
