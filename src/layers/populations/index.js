import * as Cesium from 'cesium';
import {
  createPopulationSource,
  populationZoomForCameraHeight,
} from './source.js';
import { overlayHost } from '../../app/layers/overlayHost.js';

const LAYER_ID = 'population-places';
const OVERLAY_SOURCE_ID = 'population-places';
const MAX_LABELS = 140;
const VIEWBOX_MARGIN_DEG = 0.12;

/** Convert the visible Cesium rectangle into one or two non-wrapping boxes. */
export function cameraPopulationBoxes(viewer) {
  const camera = viewer?.camera;
  if (!camera?.computeViewRectangle) return [];

  let rectangle;
  try {
    rectangle = camera.computeViewRectangle(Cesium.Ellipsoid.WGS84);
  } catch {
    return [];
  }
  if (!rectangle) return [];

  const south = Math.max(-85, Cesium.Math.toDegrees(rectangle.south));
  const north = Math.min(85, Cesium.Math.toDegrees(rectangle.north));
  const west = Cesium.Math.toDegrees(rectangle.west);
  const east = Cesium.Math.toDegrees(rectangle.east);

  const southBox = Math.max(-85, south - VIEWBOX_MARGIN_DEG);
  const northBox = Math.min(85, north + VIEWBOX_MARGIN_DEG);

  if (west <= east) {
    return [
      {
        south: southBox,
        west: Math.max(-180, west - VIEWBOX_MARGIN_DEG),
        north: northBox,
        east: Math.min(180, east + VIEWBOX_MARGIN_DEG),
      },
    ];
  }

  return [
    {
      south: southBox,
      west: Math.max(-180, west - VIEWBOX_MARGIN_DEG),
      north: northBox,
      east: 180,
    },
    {
      south: southBox,
      west: -180,
      north: northBox,
      east: Math.min(180, east + VIEWBOX_MARGIN_DEG),
    },
  ];
}

export function mergePopulationTiles(results) {
  const byKey = new Map();
  for (const result of results || []) {
    for (const place of result?.places || []) {
      const key =
        place.placeClass +
        '|' +
        place.name.toLowerCase() +
        '|' +
        place.latitude.toFixed(5) +
        '|' +
        place.longitude.toFixed(5);
      const existing = byKey.get(key);
      if (!existing || place.priority > existing.priority)
        byKey.set(key, place);
    }
  }

  return [...byKey.values()]
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        a.placeClass.localeCompare(b.placeClass) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, MAX_LABELS);
}

function populationTitle(place) {
  return place.name;
}

function populationAccessibilityLabel(place) {
  const type = {
    city: 'city',
    town: 'town',
    village: 'village',
    hamlet: 'hamlet',
  }[place.placeClass] || 'settlement';
  return place.name + ', ' + type;
}

function entryForPlace(place) {
  const isCity = place.placeClass === 'city';
  const isTown = place.placeClass === 'town';

  return {
    id: place.id,
    position: Cesium.Cartesian3.fromDegrees(
      place.longitude,
      place.latitude,
      0,
    ),
    variant: 'label',
    title: populationTitle(place),
    priority: place.priority,
    collisionGroup: 'population-label',
    zIndex: isCity ? 12 : isTown ? 10 : 8,
    accent: isCity ? '#f2c55d' : '#71d7dc',
    minDistance: 0,
    maxDistance: 8_000_000,
    distanceScale: {
      near: 20_000,
      nearValue: isCity ? 1.18 : 1.06,
      far: 5_000_000,
      farValue: isCity ? 0.78 : 0.68,
    },
    distanceFadeStartRatio: 0.72,
    edgeFade: 'keyhole',
    horizonCull: true,
    terrainOcclusion: false,
    gapPx: isCity ? 13 : 10,
    placement: 'above',
    accessibilityLabel: populationAccessibilityLabel(place),
    metadata: {
      placeClass: place.placeClass,
      rank: place.rank,
      capital: place.capital,
    },
  };
}

/**
 * Construct the settlement context layer. Labels are rendered by the shared
 * world-overlay host, so they remain decluttered and legible over imagery.
 */
export function createPopulationLayer({
  source = createPopulationSource(),
  overlay = overlayHost,
} = {}) {
  let viewer = null;
  let enabled = false;
  let request = null;
  let moveEndRemove = null;
  let places = [];
  let lastUpdate = null;
  let lastError = null;
  let status = 'idle';

  function publish() {
    overlay.setEntries(
      OVERLAY_SOURCE_ID,
      places.map(entryForPlace),
      {
        cohortLimit: MAX_LABELS * 2,
        collisionCapacity: MAX_LABELS,
        maxVisible: MAX_LABELS,
        moving: false,
        visible: enabled,
      },
    );
  }

  async function update() {
    if (!enabled || !viewer) return false;

    const boxes = cameraPopulationBoxes(viewer);
    if (!boxes.length) {
      status = 'zoom-in';
      lastError = null;
      return false;
    }

    request?.abort();
    const controller = new AbortController();
    request = controller;
    status = 'loading';
    lastError = null;

    try {
      const requestedZoom = populationZoomForCameraHeight(
        viewer.camera.positionCartographic?.height,
      );
      const results = [];

      for (const box of boxes) {
        if (controller.signal.aborted) return false;

        let loaded = false;
        let lastFailure = null;
        for (
          let zoom = requestedZoom;
          zoom >= 4;
          zoom--
        ) {
          try {
            results.push(
              await source.fetchBounds(box, {
                zoom,
                signal: controller.signal,
              }),
            );
            loaded = true;
            break;
          } catch (error) {
            if (
              controller.signal.aborted ||
              error?.name === 'AbortError'
            )
              throw error;
            lastFailure = error;
          }
        }

        if (!loaded && lastFailure) throw lastFailure;
      }

      if (
        controller.signal.aborted ||
        request !== controller ||
        !enabled
      )
        return false;

      places = mergePopulationTiles(results);
      lastUpdate = Date.now();
      status = places.length ? 'ready' : 'empty';
      lastError = null;
      publish();
      return true;
    } catch (error) {
      if (
        controller.signal.aborted ||
        request !== controller ||
        !enabled
      )
        return false;
      lastError = error?.message || 'Population map unavailable';
      status = 'unavailable';
      return false;
    } finally {
      if (request === controller) request = null;
    }
  }

  const layer = {
    id: LAYER_ID,
    name: 'Poblaciones',
    icon: '⌂',
    source: 'OpenFreeMap · OpenStreetMap',
    updateInterval: 0,

    init(nextViewer) {
      viewer = nextViewer;
      enabled = false;
      places = [];
      lastUpdate = null;
      lastError = null;
      status = 'idle';
      overlay.setVisible(OVERLAY_SOURCE_ID, false);
      return true;
    },

    enable() {
      enabled = true;
      overlay.setVisible(OVERLAY_SOURCE_ID, true);
      if (!moveEndRemove && viewer?.camera?.moveEnd?.addEventListener) {
        moveEndRemove = viewer.camera.moveEnd.addEventListener(() => {
          void update();
        });
      }
      publish();
      return true;
    },

    disable() {
      enabled = false;
      request?.abort();
      request = null;
      moveEndRemove?.();
      moveEndRemove = null;
      places = [];
      status = 'idle';
      lastError = null;
      overlay.clearSource(OVERLAY_SOURCE_ID);
      overlay.setVisible(OVERLAY_SOURCE_ID, false);
      return true;
    },

    update() {
      return update();
    },

    getStats() {
      return {
        count: places.length,
        lastUpdate,
        error: lastError,
        statusMessage:
          status === 'zoom-in'
            ? 'Ajustando contexto territorial a la vista'
            : null,
      };
    },

    destroy() {
      request?.abort();
      request = null;
      moveEndRemove?.();
      moveEndRemove = null;
      overlay.clearSource(OVERLAY_SOURCE_ID);
      overlay.setVisible(OVERLAY_SOURCE_ID, false);
      source.clear?.();
      places = [];
      viewer = null;
      enabled = false;
      lastUpdate = null;
      lastError = null;
      status = 'idle';
      return true;
    },

    getAnalystRecords(maxCount = 1000) {
      if (!enabled) return [];
      const limit = Number.isFinite(maxCount)
        ? Math.max(1, Math.floor(maxCount))
        : 1000;
      return places.slice(0, limit).map((place) => ({
        id: place.id,
        name: place.name,
        type: place.placeClass,
        rank: place.rank,
        capital: place.capital,
        lat: place.latitude,
        lon: place.longitude,
      }));
    },
  };

  return layer;
}

export { createPopulationSource };
