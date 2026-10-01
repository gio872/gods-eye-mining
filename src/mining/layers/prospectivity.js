import * as Cesium from 'cesium';
import { createMiningEngine } from '../core/miningEngine.js';
import { createMiningEvidenceBridge } from '../evidence.js';
import { clamp } from '../core/miningTypes.js';

const GRID_RADIUS = 1;
const GRID_STEP_DEGREES = 0.01;
const TARGET_HEIGHT_M = 18;

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
  for (let dy = -GRID_RADIUS; dy <= GRID_RADIUS; dy += 1) {
    for (let dx = -GRID_RADIUS; dx <= GRID_RADIUS; dx += 1) {
      points.push({
        id: `gem-${dy + GRID_RADIUS}-${dx + GRID_RADIUS}`,
        lat: center.lat + dy * GRID_STEP_DEGREES,
        lon: center.lon + dx * GRID_STEP_DEGREES,
      });
    }
  }
  return points;
}

function scoreColor(score) {
  const hue = clamp((1 - score) * 0.33);
  return Cesium.Color.fromHsl(hue, 0.9, 0.5, 0.9);
}

function publishTargets(dataSource, targets) {
  dataSource.entities.removeAll();
  for (const target of targets) {
    const entity = dataSource.entities.add({
      id: target.id,
      position: Cesium.Cartesian3.fromDegrees(
        target.longitude,
        target.latitude,
        TARGET_HEIGHT_M,
      ),
      point: {
        pixelSize: 10 + target.score * 12,
        color: scoreColor(target.score),
        outlineColor: Cesium.Color.WHITE.withAlpha(0.75),
        outlineWidth: 1,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      properties: new Cesium.PropertyBag({
        commodity: target.commodity,
        score: target.score,
        confidence: target.confidence,
        terrain: target.factors.terrain,
        hydrology: target.factors.hydrology,
        geology: target.factors.geology,
        remoteSensing: target.factors['remote-sensing'],
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
  signal = null,
} = {}) {
  const evidence = createMiningEvidenceBridge({
    terrain: surface?.terrain,
    featureSource,
    geologySource,
    imageryLayer,
    getContextLayers,
    signal,
  });
  const mining = createMiningEngine();
  let viewer = null;
  let dataSource = null;
  let enabled = false;
  let destroyed = false;
  let refreshing = false;
  let lastUpdate = null;
  let lastError = null;
  let lastEvidence = [];

  async function refresh() {
    if (!enabled || destroyed || refreshing || !viewer) return false;
    const centre = cameraCentre(viewer);
    if (!centre) return false;
    refreshing = true;
    lastError = null;
    try {
      const points = gridAround(centre);
      const analysed = await evidence.buildEvidence(points);
      mining.clear();
      for (const row of analysed) {
        mining.upsert({
          id: row.id,
          latitude: row.lat,
          longitude: row.lon,
          commodity: 'gold',
          factors: row.factors,
          metadata: row.metadata,
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
    source: 'GEM · Terrain + Hydrology + Geology + Imagery',
    updateInterval: 0,

    init(nextViewer) {
      viewer = nextViewer || null;
      if (!dataSource && viewer) {
        dataSource = new Cesium.CustomDataSource('gem-prospectivity');
        viewer.dataSources.add(dataSource);
      }
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
      if (dataSource && viewer?.dataSources?.contains?.(dataSource))
        viewer.dataSources.remove(dataSource, true);
      dataSource = null;
      viewer = null;
      lastEvidence = [];
      destroyed = true;
    },

    getStats() {
      return {
        count: mining.getTargets().length,
        lastUpdate,
        refreshing,
        error: lastError,
        evidence: {
          hydrology: lastEvidence.some((row) => row.metadata?.hydrologySource),
          geology: lastEvidence.some((row) => row.metadata?.geologyAvailable),
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
        commodity: target.commodity,
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
