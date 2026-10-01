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
        score: target.score,
        confidence: target.confidence,
        terrain: target.factors.terrain,
        hydrology: target.factors.hydrology,
        geology: target.factors.geology,
        structure: target.factors.structure,
        mineralization: target.factors.mineralization,
        remoteSensing: target.factors['remote-sensing'],
        alluvial: target.factors.alluvial,
        sampling: target.factors.sampling,
        matchedGeologyUnit: target.metadata?.matchedGeologyUnit || '',
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
      return false;
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
      void refresh();
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
        evidence: {
          hydrology: lastEvidence.some((row) => row.metadata?.hydrologySource),
          geology: lastEvidence.some((row) => row.metadata?.geologyAvailable),
          structure: lastEvidence.some((row) => row.metadata?.structureSource),
          mineralization: lastEvidence.some(
            (row) => row.metadata?.mineralizationSource,
          ),
          alluvial: lastEvidence.some((row) => row.metadata?.alluvialSource),
          imagery: lastEvidence.some((row) => row.metadata?.imagerySource),
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
