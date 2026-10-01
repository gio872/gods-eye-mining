import * as Cesium from 'cesium';
import { createMiningEngine } from '../core/miningEngine.js';
import { createMiningEvidenceBridge } from '../evidence.js';
import {
  clamp,
  PROSPECTIVITY_PROFILES,
} from '../core/miningTypes.js';

const GRID_RADIUS = 3;
const GRID_STEP_DEGREES = 0.005;
const TARGET_POINT_THRESHOLD = 0.55;


function propertyValue(entity, name, fallback = null) {
  try {
    const property = entity?.properties?.[name];
    const value =
      typeof property?.getValue === 'function'
        ? property.getValue(Cesium.JulianDate.now())
        : property;
    return value == null ? fallback : value;
  } catch {
    return fallback;
  }
}

function factorLabel(name) {
  return {
    terrain: 'Terreno',
    hydrology: 'Hidrología',
    geology: 'Geología',
    structure: 'Estructura',
    mineralization: 'Mineralización',
    remoteSensing: 'Sentinel-2 / HLS',
    alluvial: 'Aluvial',
    geochemistry: 'Geoquímica',
    lineaments: 'Lineamientos',
    drainage: 'Drenaje',
  }[name] || name;
}

function formatFactor(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : '—';
}

function showTargetDetail(container, entity) {
  if (!container || !entity) return;
  const score = Number(propertyValue(entity, 'score', 0));
  const confidence = Number(propertyValue(entity, 'confidence', 0));
  const lat = Number(propertyValue(entity, 'latitude', 0));
  const lon = Number(propertyValue(entity, 'longitude', 0));
  const factors = {
    terrain: propertyValue(entity, 'terrain', 0),
    hydrology: propertyValue(entity, 'hydrology', 0),
    geology: propertyValue(entity, 'geology', 0),
    structure: propertyValue(entity, 'structure', 0),
    mineralization: propertyValue(entity, 'mineralization', 0),
    remoteSensing: propertyValue(entity, 'remoteSensing', 0),
    alluvial: propertyValue(entity, 'alluvial', 0),
    geochemistry: propertyValue(entity, 'geochemistry', 0),
    lineaments: propertyValue(entity, 'lineaments', 0),
    drainage: propertyValue(entity, 'drainage', 0),
  };
  const rows = Object.entries(factors)
    .map(
      ([name, value]) =>
        '<div style="display:flex;justify-content:space-between;gap:12px;margin:3px 0"><span>' +
        factorLabel(name) +
        '</span><strong>' +
        formatFactor(value) +
        '</strong></div>',
    )
    .join('');
  container.innerHTML =
    '<div style="font-size:12px;letter-spacing:.16em;color:#55e8ff;margin-bottom:8px">GEM TARGET</div>' +
    '<div style="font-size:24px;font-weight:700;margin-bottom:4px">Score ' +
    formatFactor(score) +
    '</div>' +
    '<div style="font-size:12px;margin-bottom:10px">Confianza: ' +
    formatFactor(confidence) +
    ' · ' +
    lat.toFixed(5) +
    ', ' +
    lon.toFixed(5) +
    '</div>' +
    '<div style="border-top:1px solid rgba(85,232,255,.25);padding-top:7px">' +
    rows +
    '</div>';
  container.hidden = false;
}

function cameraCentre(viewer) {
  const canvas = viewer?.scene?.canvas;
  const ellipsoid = viewer?.scene?.ellipsoid || Cesium.Ellipsoid.WGS84;
  const width = Number(canvas?.clientWidth);
  const height = Number(canvas?.clientHeight);
  if (!(width > 0) || !(height > 0)) return null;
  const hit = viewer.camera?.pickEllipsoid?.(
    { x: width / 2, y: height / 2 },
    ellipsoid,
  );
  const cartographic = hit
    ? ellipsoid.cartesianToCartographic(hit)
    : null;
  if (!cartographic) return null;
  return {
    lat: Cesium.Math.toDegrees(cartographic.latitude),
    lon: Cesium.Math.toDegrees(cartographic.longitude),
  };
}

function gridAround(center) {
  const points = [];
  let row = 0;
  for (let dy = -GRID_RADIUS; dy <= GRID_RADIUS; dy += 1) {
    let col = 0;
    for (let dx = -GRID_RADIUS; dx <= GRID_RADIUS; dx += 1) {
      const lat = center.lat + dy * GRID_STEP_DEGREES;
      const lon = center.lon + dx * GRID_STEP_DEGREES;
      points.push({
        id: `gem-${row}-${col}`,
        lat,
        lon,
        gridRow: row,
        gridCol: col,
        cell: {
          west: lon - GRID_STEP_DEGREES / 2,
          east: lon + GRID_STEP_DEGREES / 2,
          south: lat - GRID_STEP_DEGREES / 2,
          north: lat + GRID_STEP_DEGREES / 2,
        },
      });
      col += 1;
    }
    row += 1;
  }
  return points;
}

function scoreColor(score, alpha = 0.5) {
  const hue = clamp((1 - score) * 0.33);
  return Cesium.Color.fromHsl(hue, 0.92, 0.5, alpha);
}

function publishTargets(dataSource, targets) {
  dataSource.entities.removeAll();
  for (const target of targets) {
    const cell = target.metadata?.cell;
    const graphics = {};
    if (
      cell &&
      Number.isFinite(cell.west) &&
      Number.isFinite(cell.south) &&
      Number.isFinite(cell.east) &&
      Number.isFinite(cell.north)
    ) {
      graphics.rectangle = {
        coordinates: Cesium.Rectangle.fromDegrees(
          cell.west,
          cell.south,
          cell.east,
          cell.north,
        ),
        material: scoreColor(target.score, 0.24 + target.score * 0.50),
        outline: target.score >= TARGET_POINT_THRESHOLD,
        outlineColor: scoreColor(target.score, 0.82),
        outlineWidth: 1,
        height: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      };
    }
    if (target.score >= TARGET_POINT_THRESHOLD) {
      graphics.position = Cesium.Cartesian3.fromDegrees(
        target.longitude,
        target.latitude,
      );
      graphics.point = {
        pixelSize: 8 + target.score * 14,
        color: scoreColor(target.score, 1),
        outlineColor: Cesium.Color.WHITE.withAlpha(0.85),
        outlineWidth: 1,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      };
    }
    const entity = dataSource.entities.add({
      id: target.id,
      ...graphics,
      properties: new Cesium.PropertyBag({
        commodity: target.commodity,
        profile: target.profile,
        latitude: target.latitude,
        longitude: target.longitude,
        score: target.score,
        confidence: target.confidence,
        terrain: target.factors.terrain,
        hydrology: target.factors.hydrology,
        geology: target.factors.geology,
        structure: target.factors.structure,
        mineralization: target.factors.mineralization,
        remoteSensing: target.factors['remote-sensing'],
        alluvial: target.factors.alluvial,
        geochemistry: target.factors.geochemistry,
        lineaments: target.factors.lineaments,
        drainage: target.factors.drainage,
        sampling: target.factors.sampling,
        auAnomaly: target.metadata?.auAnomaly ?? 0,
        agAnomaly: target.metadata?.agAnomaly ?? 0,
        cuAnomaly: target.metadata?.cuAnomaly ?? 0,
        rawAu: target.metadata?.rawAu ?? null,
        rawAg: target.metadata?.rawAg ?? null,
        rawCu: target.metadata?.rawCu ?? null,
        matchedGeologyUnit: target.metadata?.matchedGeologyUnit || '',
        spectralIndices: JSON.stringify(target.metadata?.spectralIndices || {}),
        spectralScene: JSON.stringify(target.metadata?.spectralScene || {}),
      }),
    });
  }
}

export function createProspectivityLayer({
  surface,
  featureSource,
  geologySource,
  imageryLayer,
  getContextLayers = () => [],
  remoteSensingSource = null,
  signal = null,
  commodity = 'gold',
  profile = 'gold-alluvial',
} = {}) {
  const selectedProfile = PROSPECTIVITY_PROFILES[profile]
    ? profile
    : 'gold-alluvial';
  const evidence = createMiningEvidenceBridge({
    terrain: surface?.terrain,
    featureSource,
    geologySource,
    imageryLayer,
    remoteSensingSource,
    getContextLayers,
    signal,
  });
  const mining = createMiningEngine({ profile: selectedProfile });
  let viewer = null;
  let dataSource = null;
  let enabled = false;
  let destroyed = false;
  let refreshing = false;
  let lastUpdate = null;
  let lastError = null;
  let lastEvidence = [];
  let removeMoveEnd = null;
  let clickHandler = null;
  let detailPanel = null;

  async function refresh() {
    if (!enabled || destroyed || refreshing || !viewer) return false;
    const centre = cameraCentre(viewer);
    if (!centre) return false;
    refreshing = true;
    lastError = null;
    try {
      const points = gridAround(centre);
      const analysed = await evidence.buildEvidence(points, {
        commodity,
        profile: selectedProfile,
      });
      mining.clear();
      for (const row of analysed) {
        mining.upsert({
          id: row.id,
          latitude: row.lat,
          longitude: row.lon,
          commodity,
          profile: selectedProfile,
          factors: row.factors,
          confidence: row.metadata?.evidenceCoverage ?? 0,
          metadata: {
            ...row.metadata,
            cell: row.cell,
          },
          source: 'GEM',
        });
      }
      const targets = mining.getTargets();
      publishTargets(dataSource, targets);
      lastEvidence = analysed;
      lastUpdate = Date.now();
      return true;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      // Evidence-source failures must not tear down the GEM layer. Keep the
      // layer enabled and expose the failure through getStats() so the operator
      // can distinguish degraded evidence from a lifecycle failure.
      return true;
    } finally {
      refreshing = false;
    }
  }

  const layer = {
    id: 'gem-prospectivity',
    name: 'GEM Prospectivity',
    icon: '⛏',
    source: `GEM · ${PROSPECTIVITY_PROFILES[selectedProfile].label}`,
    updateInterval: 0,

    init(nextViewer) {
      viewer = nextViewer || null;
      if (!dataSource && viewer) {
        dataSource = new Cesium.CustomDataSource('gem-prospectivity');
        viewer.dataSources.add(dataSource);
      }
      if (!detailPanel && viewer?.container) {
        detailPanel = document.createElement('div');
        detailPanel.hidden = true;
        detailPanel.style.cssText =
          'position:absolute;top:120px;right:24px;width:300px;max-height:48vh;overflow:auto;padding:14px 16px;' +
          'box-sizing:border-box;border:1px solid rgba(85,232,255,.55);background:rgba(4,12,18,.92);' +
          'color:#e9fbff;font-family:monospace;font-size:12px;line-height:1.35;z-index:50;pointer-events:none;' +
          'box-shadow:0 0 24px rgba(0,0,0,.35);backdrop-filter:blur(6px);';
        viewer.container.appendChild(detailPanel);
      }
      clickHandler?.destroy?.();
      clickHandler = null;
      if (viewer?.scene?.canvas) {
        clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        clickHandler.setInputAction((movement) => {
          if (!enabled) return;
          const picked = viewer.scene.pick(movement.position);
          const entity = picked?.id;
          if (!entity || typeof entity.id !== 'string' || !entity.id.startsWith('gem-')) {
            if (detailPanel) detailPanel.hidden = true;
            return;
          }
          showTargetDetail(detailPanel, entity);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      }
      removeMoveEnd?.();
      removeMoveEnd = null;
      const remover = viewer?.camera?.moveEnd?.addEventListener?.(() => {
        if (enabled) void refresh();
      });
      removeMoveEnd = typeof remover === 'function' ? remover : null;
      return true;
    },

    enable(nextViewer) {
      if (destroyed) return false;
      viewer = nextViewer || viewer;
      if (!viewer || !dataSource) return false;
      enabled = true;
      // LayerLifecycle owns the first update; do not start a concurrent refresh here.
      return true;
    },

    disable() {
      if (!enabled) return true;
      enabled = false;
      dataSource?.entities.removeAll();
      return true;
    },

    async update() {
      if (!enabled || destroyed) return false;
      return refresh();
    },

    destroy() {
      if (destroyed) return;
      enabled = false;
      removeMoveEnd?.();
      removeMoveEnd = null;
      clickHandler?.destroy?.();
      clickHandler = null;
      detailPanel?.remove?.();
      detailPanel = null;
      if (dataSource && viewer?.dataSources?.contains?.(dataSource))
        viewer.dataSources.remove(dataSource, true);
      dataSource = null;
      viewer = null;
      lastEvidence = [];
      destroyed = true;
    },

    getParams() {
      return {
        commodity,
        profile: selectedProfile,
        gridStepDegrees: GRID_STEP_DEGREES,
        gridSize: GRID_RADIUS * 2 + 1,
      };
    },

    getStats() {
      return {
        count: mining.getTargets().length,
        lastUpdate,
        refreshing,
        error: lastError,
        commodity,
        profile: selectedProfile,
        gridCells: (GRID_RADIUS * 2 + 1) ** 2,
        evidenceChannels: 10,
        evidence: {
          hydrology: lastEvidence.some((row) => row.metadata?.hydrologySource),
          geology: lastEvidence.some((row) => row.metadata?.geologyAvailable),
          structure: lastEvidence.some((row) => row.metadata?.structureSource),
          mineralization: lastEvidence.some(
            (row) => row.metadata?.mineralizationSource,
          ),
          alluvial: lastEvidence.some((row) => row.metadata?.alluvialSource),
          geochemistry: lastEvidence.some((row) => row.metadata?.geochemistrySource),
          lineaments: lastEvidence.some((row) => row.metadata?.lineamentSource),
          drainage: lastEvidence.some((row) => row.metadata?.drainageSource),
          imagery: lastEvidence.some((row) => row.metadata?.remoteSensingSource),
          terrain: lastEvidence.some((row) => row.metadata?.terrainSource),
        },
      };
    },

    getAnalystRecords() {
      return mining.getTargets().map((target) => ({
        id: target.id,
        lat: target.latitude,
        lon: target.longitude,
        score: target.score,
        confidence: target.confidence,
        commodity: target.commodity,
        profile: target.profile,
        factors: target.factors,
      }));
    },

    getSnapshot() {
      return Object.freeze({
        targets: mining.getTargets(),
        evidence: lastEvidence.map((row) => ({ ...row })),
      });
    },
  };

  return layer;
}
