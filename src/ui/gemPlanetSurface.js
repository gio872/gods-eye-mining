import * as Cesium from 'cesium';
import { GEE_DATASETS } from '../maps/geeImagery.js';

const GRID_ID = 'gem-planetary-surface-grid';

export function formatPlanetaryCoordinate(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '—';
  const lat = Math.abs(latitude).toFixed(4) + '° ' + (latitude >= 0 ? 'N' : 'S');
  const lon = Math.abs(longitude).toFixed(4) + '° ' + (longitude >= 0 ? 'E' : 'W');
  return lat + ' · ' + lon;
}

/** Normalize a user-entered country, place or coordinate query before geocoding. */
export function normalizePlanetarySearchQuery(value) {
  return String(value ?? '').trim().slice(0, 240);
}

export function formatPlanetaryDistance(meters) {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters < 1000) return Math.round(meters) + ' m';
  if (meters < 100000) return (meters / 1000).toFixed(2) + ' km';
  return (meters / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' km';
}

export function getAvailablePlanetaryStacks(controller) {
  if (!controller || typeof controller.getStacks !== 'function') return [];
  return controller.getStacks().map((stack) => ({
    id: stack.id,
    label: stack.label || stack.shortLabel || stack.id,
    available: stack.available !== false,
    unavailableReason: stack.unavailableReason || null,
    requiresIon: Boolean(stack.requiresIon),
  }));
}

/** Return configured world-imagery sources in a reliable global-view order. */
export function getGlobalSurfaceStackCandidates(controller) {
  if (!controller || typeof controller.getStacks !== 'function') return [];
  const stacks = controller.getStacks();
  // Satellite imagery is the default world surface; OSM remains the final fallback.
  const preferred = ['esri-imagery', 'bing-aerial', 'gee-global-eo', 'bing-labels', 'osm'];
  return preferred
    .map((id) => stacks.find((stack) => stack.id === id))
    .filter((stack) => stack && stack.available !== false && stack.kind !== 'photoreal');
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function geodesicDistance(a, b) {
  const start = Cesium.Cartographic.fromCartesian(a);
  const end = Cesium.Cartographic.fromCartesian(b);
  const geodesic = new Cesium.EllipsoidGeodesic(start, end);
  return geodesic.surfaceDistance;
}

function globalCamera(viewer, duration = 1.8) {
  if (!viewer || viewer.isDestroyed()) return;
  const destination = Cesium.Cartesian3.fromDegrees(0, 15, 24500000);
  viewer.camera.cancelFlight();
  viewer.camera.flyTo({
    destination,
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-90),
      roll: 0,
    },
    duration,
    easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
  });
}

function regionCamera(viewer, longitude, latitude, altitude = 7000000) {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, altitude),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-90),
      roll: 0,
    },
    duration: 1.6,
    easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
  });
}

function addCoordinateGrid(viewer) {
  const old = viewer.dataSources.getByName(GRID_ID)[0];
  if (old) return old;
  const source = new Cesium.CustomDataSource(GRID_ID);
  const material = Cesium.Color.CYAN.withAlpha(0.24);
  for (let latitude = -80; latitude <= 80; latitude += 10) {
    const coordinates = [];
    for (let longitude = -180; longitude <= 180; longitude += 5)
      coordinates.push(longitude, latitude);
    source.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray(coordinates),
        width: 1,
        material,
        arcType: Cesium.ArcType.GEODESIC,
      },
    });
  }
  for (let longitude = -180; longitude < 180; longitude += 10) {
    const coordinates = [];
    for (let latitude = -90; latitude <= 90; latitude += 5)
      coordinates.push(longitude, latitude);
    source.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray(coordinates),
        width: 1,
        material,
        arcType: Cesium.ArcType.GEODESIC,
      },
    });
  }
  viewer.dataSources.add(source);
  return source;
}

function removeCoordinateGrid(viewer) {
  const source = viewer.dataSources.getByName(GRID_ID)[0];
  if (source) viewer.dataSources.remove(source, true);
}

function planetarySourceNote(stack) {
  if (stack?.unavailableReason) return stack.unavailableReason;
  if (stack?.id === 'gee-global-eo') {
    return 'GEE raster access requires valid server-side Earth Engine authentication. Dataset requests run through the GEM gateway.';
  }
  if (stack?.id === 'photoreal') {
    return 'Photorealistic city detail is provider-dependent; use an available global imagery stack where this is unavailable.';
  }
  return 'Source selection is managed by the live GEM map-source controller.';
}

function buildPanel() {
  const panel = document.createElement('section');
  panel.className = 'gem-planet-surface';
  panel.setAttribute('aria-label', 'GEM Planet global surface controls');
  panel.innerHTML = `
    <header class="gps-head">
      <div class="gps-brand"><span class="gps-mark">◎</span><div><small>TERRAQUEEN GEM · PLANETARY DATA FABRIC</small><strong>GLOBAL SURFACE</strong></div></div>
      <button type="button" class="gps-icon-button" data-minimize aria-label="Minimize controls" title="Minimize controls">−</button>
      <button type="button" class="gps-icon-button" data-close aria-label="Return to GEM" title="Return to GEM">×</button>
    </header>
    <div class="gps-body">
      <form class="gps-search" data-search-form>
        <span aria-hidden="true">⌕</span>
        <input name="query" autocomplete="off" placeholder="Search a place, country or coordinates…" aria-label="Search global surface" maxlength="240">
        <button type="submit">GO</button>
      </form>
      <div class="gps-search-status" data-search-status role="status" aria-live="polite">WORLDWIDE VIEW · WGS84</div>
      <div class="gps-section">
        <div class="gps-section-head"><span>QUICK NAVIGATION</span><small>FLY TO</small></div>
        <div class="gps-quick-nav">
          <button type="button" data-region="world">World</button>
          <button type="button" data-region="colombia">Colombia</button>
          <button type="button" data-region="south-america">South America</button>
          <button type="button" data-region="africa">Africa</button>
          <button type="button" data-region="asia">Asia</button>
          <button type="button" data-region="dubai">Dubai</button>
        </div>
      </div>
      <div class="gps-section">
        <div class="gps-section-head"><span>MAP SOURCE</span><small data-source-state>CHECKING</small></div>
        <label class="gps-field"><span>Basemap / imagery</span><select data-basemap aria-label="Basemap"></select></label>
        <label class="gps-field gps-hidden" data-gee-row><span>Earth observation dataset</span><select data-gee-dataset aria-label="Earth observation dataset"></select></label>
        <div class="gps-source-note" data-source-note>Only map sources available in this GEM runtime can be selected.</div>
      </div>
      <div class="gps-section">
        <div class="gps-section-head"><span>SURFACE DISPLAY</span><small>LIVE SCENE</small></div>
        <label class="gps-toggle"><span><b>Atmosphere</b><small>Planetary limb and sky scattering</small></span><input type="checkbox" data-atmosphere checked><i></i></label>
        <label class="gps-toggle"><span><b>Terrain lighting</b><small>Day-side shading where terrain is active</small></span><input type="checkbox" data-lighting><i></i></label>
        <label class="gps-toggle"><span><b>Coordinate grid</b><small>10° graticule for geographic orientation</small></span><input type="checkbox" data-grid><i></i></label>
      </div>
      <div class="gps-section">
        <div class="gps-section-head"><span>CAMERA & TOOLS</span><small>INTERACTIVE</small></div>
        <div class="gps-camera-actions">
          <button type="button" data-camera="global"><b>◎</b><span>Global</span></button>
          <button type="button" data-camera="zoom-in"><b>＋</b><span>Zoom in</span></button>
          <button type="button" data-camera="zoom-out"><b>－</b><span>Zoom out</span></button>
          <button type="button" data-camera="north"><b>↑</b><span>North up</span></button>
          <button type="button" data-camera="3d"><b>3D</b><span>Globe</span></button>
          <button type="button" data-camera="2d"><b>2D</b><span>Flat map</span></button>
          <button type="button" data-measure><b>⌁</b><span>Measure</span></button>
          <button type="button" data-clear-measure><b>↺</b><span>Clear measure</span></button>
        </div>
        <div class="gps-measure-status" data-measure-status>Distance measurement is off.</div>
      </div>
      <footer class="gps-readouts">
        <div><small>CURSOR POSITION</small><b data-coordinates>Move over the globe</b></div>
        <div><small>CAMERA ALTITUDE</small><b data-altitude>—</b></div>
        <div><small>ACTIVE MAP</small><b data-active-map>—</b></div>
      </footer>
      <p class="gps-trust-note">GEM map sources reflect the providers configured for this runtime. Satellite imagery, elevation and thematic layers are separate data products; a basemap is not geological evidence.</p>
    </div>
  `;
  return panel;
}

function installStyles() {
  if (document.getElementById('gem-planet-surface-style')) return;
  const style = document.createElement('style');
  style.id = 'gem-planet-surface-style';
  style.textContent = `
    .gem-planet-surface{position:fixed;left:18px;top:86px;bottom:18px;z-index:20000;width:min(365px,calc(100vw - 36px));color:#eaf8fb;border:1px solid rgba(110,202,218,.23);border-radius:18px;background:linear-gradient(160deg,rgba(5,17,25,.96),rgba(3,9,15,.92));backdrop-filter:blur(18px);box-shadow:0 22px 75px rgba(0,0,0,.42),inset 0 1px rgba(255,255,255,.04);font-family:Inter,ui-sans-serif,system-ui,sans-serif;display:flex;flex-direction:column;overflow:hidden}
    .gem-planet-surface *{box-sizing:border-box}.gps-head{display:flex;align-items:center;gap:8px;padding:14px 14px 13px;border-bottom:1px solid rgba(145,194,207,.12);background:rgba(8,22,31,.7)}
    .gps-brand{display:flex;align-items:center;gap:10px;min-width:0;flex:1}.gps-mark{display:grid;place-items:center;width:34px;height:34px;border:1px solid rgba(104,232,244,.48);border-radius:10px;color:#68e8f4;font-size:22px;background:rgba(104,232,244,.05)}.gps-brand small{display:block;color:#69909c;font:800 7px ui-monospace,monospace;letter-spacing:.12em}.gps-brand strong{display:block;margin-top:4px;font-size:13px;letter-spacing:.09em}
    .gps-icon-button{width:31px;height:31px;border:1px solid rgba(145,194,207,.18);border-radius:8px;background:rgba(255,255,255,.025);color:#b9cfd5;font-size:18px;cursor:pointer}.gps-icon-button:hover{border-color:#68e8f4;color:#68e8f4}
    .gps-body{overflow:auto;min-height:0;padding:13px}.gps-search{display:flex;align-items:center;gap:8px;height:43px;padding:0 8px 0 11px;border:1px solid rgba(104,232,244,.28);border-radius:10px;background:rgba(104,232,244,.045)}.gps-search>span{font-size:22px;color:#68e8f4}.gps-search input{width:0;min-width:0;flex:1;border:0;outline:0;background:transparent;color:#effcff;font-size:10px}.gps-search input::placeholder{color:#718c96}.gps-search button{border:0;border-radius:7px;padding:8px 11px;background:#68e8f4;color:#041015;font:900 8px ui-monospace,monospace;cursor:pointer}
    .gps-search-status{margin:8px 2px 0;color:#72dbe7;font:800 7px ui-monospace,monospace;letter-spacing:.08em;line-height:1.5;min-height:11px}.gps-section{margin-top:17px}.gps-section-head{display:flex;align-items:center;justify-content:space-between;margin:0 1px 8px;color:#80a1aa;font:800 8px ui-monospace,monospace;letter-spacing:.12em}.gps-section-head small{font-size:6px;color:#526f79;letter-spacing:.08em}.gps-quick-nav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.gps-quick-nav button{border:1px solid rgba(145,194,207,.13);border-radius:8px;background:rgba(255,255,255,.025);color:#aac2c9;padding:9px 5px;font-size:9px;cursor:pointer}.gps-quick-nav button:hover{border-color:rgba(104,232,244,.4);color:#68e8f4;background:rgba(104,232,244,.05)}
    .gps-field{display:grid;gap:6px;margin:9px 0;color:#8da8b1;font-size:9px}.gps-field select{width:100%;padding:10px;border:1px solid rgba(145,194,207,.18);border-radius:9px;background:#081821;color:#e9f8fb;font-size:10px;outline:0}.gps-field select:focus{border-color:rgba(104,232,244,.5)}.gps-source-note{color:#5e7b85;font-size:8px;line-height:1.5}.gps-hidden{display:none!important}
    .gps-toggle{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 1px;border-top:1px solid rgba(145,194,207,.08);cursor:pointer}.gps-toggle>span b{display:block;color:#bed0d5;font-size:9px;font-weight:650}.gps-toggle>span small{display:block;margin-top:3px;color:#62808b;font-size:8px}.gps-toggle input{position:absolute;opacity:0;pointer-events:none}.gps-toggle i{position:relative;flex:0 0 auto;width:29px;height:16px;border:1px solid rgba(145,194,207,.24);border-radius:99px;background:#0a1921;transition:.18s}.gps-toggle i:after{content:"";position:absolute;width:10px;height:10px;left:2px;top:2px;border-radius:50%;background:#718c96;transition:.18s}.gps-toggle input:checked+i{background:rgba(104,232,244,.2);border-color:rgba(104,232,244,.55)}.gps-toggle input:checked+i:after{left:15px;background:#68e8f4}
    .gps-camera-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.gps-camera-actions button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-height:55px;border:1px solid rgba(145,194,207,.13);border-radius:8px;background:rgba(255,255,255,.02);color:#8daab3;cursor:pointer}.gps-camera-actions button b{font-size:16px;font-weight:700}.gps-camera-actions button span{font-size:7px}.gps-camera-actions button:hover,.gps-camera-actions button.is-active{color:#68e8f4;border-color:rgba(104,232,244,.35);background:rgba(104,232,244,.055)}.gps-measure-status{margin-top:8px;padding:8px 9px;border:1px solid rgba(145,194,207,.1);border-radius:8px;color:#77939d;font-size:8px;line-height:1.5}
    .gps-readouts{display:grid;gap:8px;margin-top:17px;padding:12px;border:1px solid rgba(145,194,207,.13);border-radius:10px;background:rgba(0,0,0,.16)}.gps-readouts div{display:flex;align-items:center;justify-content:space-between;gap:10px}.gps-readouts small{color:#5f7c86;font:800 7px ui-monospace,monospace}.gps-readouts b{color:#a9c4cc;font:700 8px ui-monospace,monospace;text-align:right}.gps-trust-note{margin:12px 2px 2px;color:#536f79;font-size:8px;line-height:1.55}
    .gem-planet-surface.is-minimized{width:250px;bottom:auto}.gem-planet-surface.is-minimized .gps-body{display:none}.gem-planet-surface.is-minimized .gps-head{border-bottom:0}
    .gem-map-measure-label{padding:5px 7px;border:1px solid rgba(104,232,244,.4);border-radius:6px;background:rgba(3,10,15,.9);color:#68e8f4;font:800 10px ui-monospace,monospace}
    /* Focused surface mode explicitly reveals the existing Cesium canvas and
       suppresses competing full-screen command overlays. Some legacy GEM panels
       have intentionally high z-index values, so scope this override to map mode. */
    body.gem-planet-surface-open .gem-product-shell,
    body.gem-planet-surface-open .gem-workspace,
    body.gem-planet-surface-open:not(.gem-global-surface-window) .gem-command-header,
    body.gem-planet-surface-open:not(.gem-global-surface-window) .gem-map-hud,
    body.gem-planet-surface-open:not(.gem-global-surface-window) .gem-sources-panel,
    body.gem-planet-surface-open:not(.gem-global-surface-window) .gem-target-panel,
    body.gem-planet-surface-open:not(.gem-global-surface-window) .gem-bottom-intelligence,
    body.gem-planet-surface-open:not(.gem-global-surface-window) .gem-module-dock,
    body.gem-planet-surface-open:not(.gem-global-surface-window) .gem-global-intel-panel,
    body.gem-planet-surface-open:not(.gem-global-surface-window) .gem-decision-center,
    body.gem-planet-surface-open:not(.gem-global-surface-window) .gem-launch-panel,
    body.gem-planet-surface-open:not(.gem-global-surface-window) .gem-command-center-force,
    body.gem-planet-surface-open #loading-screen,
    body.gem-planet-surface-open #first-run-launcher {
      display:none!important;visibility:hidden!important;pointer-events:none!important;
    }
    body.gem-planet-surface-open #cesiumContainer {
      display:block!important;visibility:visible!important;opacity:1!important;
      position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;
      z-index:1!important;pointer-events:auto!important;
    }
    body.gem-planet-surface-open #cesiumContainer .cesium-viewer,
    body.gem-planet-surface-open #cesiumContainer .cesium-widget,
    body.gem-planet-surface-open #cesiumContainer canvas {
      visibility:visible!important;opacity:1!important;
    }
    body.gem-planet-surface-open .gem-planet-surface {
      z-index:2147483008!important;
    }
    /* Dedicated Global Surface preserves the original God’s Eye layer and
       navigation panels; the new map-tools panel is optional and non-modal. */
    body.gem-global-surface-window .gem-planet-surface {
      left:auto!important;right:14px!important;top:74px!important;bottom:14px!important;
      width:min(360px,calc(100vw - 28px))!important;
    }
    body.gem-planet-surface-open .gem-map-focus-back {
      z-index:2147483009!important;
    }
    @media(max-width:600px){.gem-planet-surface{left:8px;top:70px;bottom:8px;width:min(350px,calc(100vw - 16px));max-height:calc(100dvh - 78px)}.gem-planet-surface.is-minimized{bottom:auto}.gps-brand small{font-size:6px}}
  `;
  document.head.append(style);
}

export function installGemPlanetSurface() {
  let panel = null;
  let runtime = null;
  let startupError = null;
  let destroyed = false;
  let initialFlightDone = false;
  let screenHandler = null;
  let moveListener = null;
  let postRenderListener = null;
  let controllerUnsubscribe = null;
  let measureMode = false;
  let measureStart = null;
  let measureLine = null;
  let measurePins = [];
  let measureLines = [];
  let renderedAltitude = null;
  let activeSearchController = null;
  let pendingPlanetSearch = null;
  let gridSourceAdded = false;
  let globalSourcePromise = null;
  let initialGlobalViewPromise = null;
  const handlers = [];
  let panelHandlers = [];
  const bind = (element, type, listener, scope = 'panel') => {
    if (!element || typeof listener !== 'function') return;
    element.addEventListener(type, listener);
    const remove = () => element.removeEventListener(type, listener);
    (scope === 'persistent' ? handlers : panelHandlers).push(remove);
  };
  function removePanelHandlers() {
    for (const remove of panelHandlers.splice(0)) remove();
  }
  function disposePanelRuntime() {
    closeMeasure();
    screenHandler?.destroy();
    screenHandler = null;
    controllerUnsubscribe?.();
    controllerUnsubscribe = null;
    if (postRenderListener) postRenderListener();
    postRenderListener = null;
    removePanelHandlers();
  }

  function status(message, tone = 'normal') {
    if (!panel) return;
    const node = panel.querySelector('[data-search-status]');
    node.textContent = message;
    node.dataset.tone = tone;
  }

  function fillBasemaps() {
    if (!panel || !runtime?.mapStackController) return;
    const select = panel.querySelector('[data-basemap]');
    const current = runtime.mapStackController.getActiveId();
    const stacks = getAvailablePlanetaryStacks(runtime.mapStackController);
    select.replaceChildren();
    stacks.forEach((stack) => {
      const option = document.createElement('option');
      option.value = stack.id;
      option.textContent = stack.available ? stack.label : stack.label + ' · unavailable';
      option.disabled = !stack.available;
      if (stack.unavailableReason) option.title = stack.unavailableReason;
      select.append(option);
    });
    if (stacks.some((stack) => stack.id === current)) select.value = current;
    else if (select.options.length) select.selectedIndex = 0;
    const selected = stacks.find((stack) => stack.id === select.value);
    panel.querySelector('[data-source-state]').textContent =
      selected?.available ? 'READY' : 'LIMITED';
    panel.querySelector('[data-active-map]').textContent =
      runtime.mapStackController.getActiveStack()?.label || current || '—';
    const note = panel.querySelector('[data-source-note]');
    note.textContent = planetarySourceNote(selected);
    panel.querySelector('[data-gee-row]').classList.toggle('gps-hidden', current !== 'gee-global-eo');
  }

  function fillGeeDatasets() {
    if (!panel) return;
    const select = panel.querySelector('[data-gee-dataset]');
    select.replaceChildren();
    for (const dataset of GEE_DATASETS) {
      const option = document.createElement('option');
      option.value = dataset.key;
      option.textContent = dataset.label;
      select.append(option);
    }
    select.value = runtime?.mapStackController?.getGeeDataset?.() || 'sentinel2';
  }

  function closeMeasure() {
    measureMode = false;
    measureStart = null;
    panel?.querySelector('[data-measure]')?.classList.remove('is-active');
    const output = panel?.querySelector('[data-measure-status]');
    if (output) output.textContent = 'Distance measurement is off.';
  }

  function clearMeasureResults() {
    closeMeasure();
    if (runtime?.viewer && !runtime.viewer.isDestroyed()) {
      for (const entity of [...measurePins, ...measureLines]) runtime.viewer.entities.remove(entity);
      measurePins = [];
      measureLines = [];
      measureLine = null;
    }
    const output = panel?.querySelector('[data-measure-status]');
    if (output) output.textContent = 'Measurement cleared.';
  }

  function pickSurface(position) {
    if (!runtime?.viewer || runtime.viewer.isDestroyed()) return null;
    const { viewer } = runtime;
    // Prefer the visible depth-buffer surface (terrain or 3D tiles) when the
    // current renderer supports it; then fall back to the globe and ellipsoid.
    if (viewer.scene.pickPositionSupported) {
      const visibleSurface = viewer.scene.pickPosition(position);
      if (visibleSurface) return visibleSurface;
    }
    const ray = viewer.camera.getPickRay(position);
    const terrainPoint = ray ? viewer.scene.globe.pick(ray, viewer.scene) : null;
    return terrainPoint || viewer.camera.pickEllipsoid(position, viewer.scene.globe.ellipsoid);
  }

  function updateCoordinateReadout(position) {
    if (!panel || !runtime?.viewer || runtime.viewer.isDestroyed()) return;
    const point = pickSurface(position);
    if (!point) return;
    const cartographic = Cesium.Cartographic.fromCartesian(point);
    panel.querySelector('[data-coordinates]').textContent = formatPlanetaryCoordinate(
      Cesium.Math.toDegrees(cartographic.latitude),
      Cesium.Math.toDegrees(cartographic.longitude),
    );
  }

  function updateAltitudeReadout() {
    if (!panel || !runtime?.viewer || runtime.viewer.isDestroyed()) return;
    const altitude = runtime.viewer.camera.positionCartographic.height;
    if (!Number.isFinite(altitude)) return;
    if (renderedAltitude !== null && Math.abs(altitude - renderedAltitude) < Math.max(50, renderedAltitude * 0.02)) return;
    renderedAltitude = altitude;
    panel.querySelector('[data-altitude]').textContent =
      altitude >= 1000000 ? (altitude / 1000000).toFixed(2) + ' Mm' : altitude >= 1000 ? (altitude / 1000).toFixed(1) + ' km' : Math.round(altitude) + ' m';
  }


  function ensureGlobalSurfaceSource({ preferSatellite = false } = {}) {
    if (globalSourcePromise) return globalSourcePromise;
    const viewer = runtime?.viewer;
    if (!viewer || viewer.isDestroyed()) return Promise.resolve(false);
    const controller = runtime.mapStackController;
    if (!controller) {
      // The viewer can be ready before its imagery registry finishes loading.
      // Keep the ellipsoid rendered; the complete runtime event will attach the
      // actual map-source controller and select the best available basemap.
      viewer.scene.globe.show = true;
      viewer.scene.requestRender?.();
      return Promise.resolve(true);
    }
    const activeStack = controller.getActiveStack?.();
    const needsGlobalGlobe = viewer.scene.globe.show === false ||
      activeStack?.id === 'photoreal' || activeStack?.kind === 'photoreal';
    // Opening Planet / Global Surface deliberately returns to the best
    // configured satellite/global imagery source, even if the last session
    // was left on a street basemap. Once open, manual basemap selection is respected.
    if (!needsGlobalGlobe && !preferSatellite) return Promise.resolve(true);

    globalSourcePromise = (async () => {
      const candidates = getGlobalSurfaceStackCandidates(controller);
      const failures = [];
      for (const candidate of candidates) {
        if ((!panel && !document.body.classList.contains('gem-global-surface-window')) || !runtime?.viewer || runtime.viewer.isDestroyed()) return false;
        const liveStack = controller.getActiveStack?.();
        if (
          liveStack?.id === candidate.id &&
          viewer.scene.globe.show !== false &&
          liveStack.kind !== 'photoreal'
        ) {
          fillBasemaps();
          status(
            (candidate.id === 'osm' ? 'GLOBAL MAP FALLBACK READY · ' : 'GLOBAL SATELLITE SURFACE READY · ') +
              (liveStack.label || liveStack.id).toUpperCase(),
            'success',
          );
          return true;
        }
        status(
          (candidate.id === 'osm' ? 'LOADING GLOBAL MAP FALLBACK · ' : 'LOADING GLOBAL SATELLITE SURFACE · ') +
            candidate.label.toUpperCase(),
          'loading',
        );
        try {
          await controller.setStack(candidate.id);
          const settled = controller.getActiveStack?.();
          if (
            settled &&
            settled.id === candidate.id &&
            settled.kind !== 'photoreal' &&
            viewer.scene.globe.show !== false
          ) {
            viewer.scene.requestRender?.();
            fillBasemaps();
            status(
              (settled.id === 'osm' ? 'GLOBAL MAP FALLBACK READY · ' : 'GLOBAL SATELLITE SURFACE READY · ') +
                (settled.label || settled.id).toUpperCase(),
              'success',
            );
            return true;
          }
          failures.push(
            settled?.id && settled.id !== candidate.id
              ? candidate.label + ' redirected to ' + (settled.label || settled.id)
              : settled?.lastError || (candidate.label + ' did not activate a global globe'),
          );
        } catch (error) {
          failures.push(String(error?.message || error));
        }
      }

      // Keep the actual Cesium ellipsoid visible even when every imagery
      // provider fails. Never leave the operator looking at a hidden globe.
      if (!viewer.isDestroyed()) {
        viewer.scene.globe.show = true;
        viewer.scene.requestRender?.();
      }
      fillBasemaps();
      status(
        failures.length
          ? 'GLOBAL GLOBE VISIBLE · IMAGERY LIMITED · ' + failures[failures.length - 1]
          : 'GLOBAL CESIUM ELLIPSOID VISIBLE · NO IMAGERY SOURCE AVAILABLE',
        'error',
      );
      return true;
    })().finally(() => {
      globalSourcePromise = null;
    });
    return globalSourcePromise;
  }

  async function focusGlobalSurface(duration = 1.8) {
    const ready = await ensureGlobalSurfaceSource({ preferSatellite: true });
    if (!ready || (!panel && !document.body.classList.contains('gem-global-surface-window')) || !runtime?.viewer || runtime.viewer.isDestroyed()) return;
    globalCamera(runtime.viewer, duration);
    runtime.viewer.scene.requestRender?.();
    fillBasemaps();
  }

  /** Activate a worldwide-capable basemap and camera without forcing the tools panel open. */
  async function activateGlobalSurface(duration = 2.2) {
    const ready = await ensureGlobalSurfaceSource({ preferSatellite: true });
    if (!ready || !runtime?.viewer || runtime.viewer.isDestroyed()) return false;
    globalCamera(runtime.viewer, duration);
    runtime.viewer.scene.requestRender?.();
    fillBasemaps();
    return true;
  }

  function startInitialGlobalView() {
    if (initialFlightDone || !panel || !runtime?.viewer || runtime.viewer.isDestroyed()) return initialGlobalViewPromise;
    initialFlightDone = true;
    return startGlobalViewFlight(2.4, 'GLOBAL SURFACE INITIALIZATION FAILED');
  }

  function startGlobalViewFlight(duration = 1.8, errorLabel = 'GLOBAL SURFACE INITIALIZATION FAILED') {
    if (initialGlobalViewPromise) return initialGlobalViewPromise;
    initialGlobalViewPromise = ensureGlobalSurfaceSource({ preferSatellite: true }).then(() => {
      if (!panel || !runtime?.viewer || runtime.viewer.isDestroyed()) return;
      if (pendingPlanetSearch) {
        launchPendingSearch();
        return;
      }
      globalCamera(runtime.viewer, duration);
      fillBasemaps();
    }).catch((error) => {
      if (panel) status(errorLabel + ' · ' + String(error?.message || error), 'error');
    }).finally(() => {
      initialGlobalViewPromise = null;
    });
    return initialGlobalViewPromise;
  }

  function startReopenedGlobalView() {
    if (!panel || !runtime?.viewer || runtime.viewer.isDestroyed()) return;
    void startGlobalViewFlight(1.6, 'GLOBAL SURFACE RELOAD FAILED');
  }

  async function runSearch(query) {
    const value = String(query || '').trim();
    if (!value || !runtime?.viewer || runtime.viewer.isDestroyed()) return;
    activeSearchController?.abort();
    activeSearchController = new AbortController();
    const request = activeSearchController;
    status('SEARCHING · ' + value, 'loading');
    try {
      await ensureGlobalSurfaceSource();
      if (request.signal.aborted || !panel) return;
      const result = await runtime.operations?.searchAndFlyTo?.(runtime.viewer, value, {
        placeSearch: runtime.placeSearch,
        duration: 2.4,
        signal: request.signal,
      });
      if (request.signal.aborted || !panel) return;
      if (!result) {
        status('NO MATCH FOUND · TRY A PLACE NAME OR DECIMAL COORDINATES', 'error');
        return;
      }
      status('NAVIGATED · ' + (result.label || value), 'success');
    } catch (error) {
      if (request.signal.aborted || !panel) return;
      status('SEARCH FAILED · ' + String(error?.message || error), 'error');
    }
  }

  function launchPendingSearch() {
    if (!pendingPlanetSearch || !panel || !screenHandler ||
        !runtime?.viewer || runtime.viewer.isDestroyed()) return;
    const query = pendingPlanetSearch;
    pendingPlanetSearch = null;
    const input = panel.querySelector('[name="query"]');
    if (input) input.value = query;
    void ensureGlobalSurfaceSource().then(() => runSearch(query));
  }

  function requestPlanetSearch(query) {
    const value = normalizePlanetarySearchQuery(query);
    if (!value) {
      openSurface();
      status('ENTER A COUNTRY, PLACE OR COORDINATE PAIR', 'error');
      panel?.querySelector('[name="query"]')?.focus();
      return;
    }
    pendingPlanetSearch = value;
    openSurface();
    // If the first world activation is still in flight, it will launch this
    // search after the global base map settles, avoiding competing camera flights.
    if (!initialGlobalViewPromise) launchPendingSearch();
  }

  function wirePanel() {
    if (!panel) return;
    bind(panel.querySelector('[data-search-form]'), 'submit', (event) => {
      event.preventDefault();
      void runSearch(new FormData(event.currentTarget).get('query'));
    });
    bind(panel.querySelector('[data-basemap]'), 'change', async (event) => {
      const id = event.currentTarget.value;
      status('SWITCHING MAP SOURCE · ' + id.toUpperCase(), 'loading');
      try {
        await runtime.mapStackController.setStack(id);
      } catch (error) {
        status('MAP SOURCE FAILED · ' + String(error?.message || error), 'error');
      }
      fillBasemaps();
    });
    bind(panel.querySelector('[data-gee-dataset]'), 'change', (event) => {
      runtime.mapStackController.setGeeDataset(event.currentTarget.value);
      status('EARTH OBSERVATION DATASET · ' + event.currentTarget.selectedOptions[0]?.textContent, 'normal');
    });
    bind(panel.querySelector('[data-atmosphere]'), 'change', (event) => {
      runtime.viewer.scene.skyAtmosphere.show = event.currentTarget.checked;
      runtime.viewer.scene.requestRender();
    });
    bind(panel.querySelector('[data-lighting]'), 'change', (event) => {
      runtime.viewer.scene.globe.enableLighting = event.currentTarget.checked;
      runtime.viewer.scene.requestRender();
    });
    bind(panel.querySelector('[data-grid]'), 'change', (event) => {
      if (event.currentTarget.checked) {
        addCoordinateGrid(runtime.viewer);
        gridSourceAdded = true;
        status('COORDINATE GRID ENABLED · 10°', 'success');
      } else {
        removeCoordinateGrid(runtime.viewer);
        gridSourceAdded = false;
        status('COORDINATE GRID DISABLED', 'normal');
      }
    });
    panel.querySelectorAll('[data-region]').forEach((button) => bind(button, 'click', () => {
      const regions = {
        world: [0, 15, 24500000],
        colombia: [-73.5, 4.5, 2300000],
        'south-america': [-60, -15, 7500000],
        africa: [20, 2, 8000000],
        asia: [95, 30, 10500000],
        dubai: [55.27, 25.2, 350000],
      };
      const [longitude, latitude, altitude] = regions[button.dataset.region] || regions.world;
      if (button.dataset.region === 'world') {
        void focusGlobalSurface();
      } else regionCamera(runtime.viewer, longitude, latitude, altitude);
      status('FLY TO · ' + button.textContent.toUpperCase(), 'success');
    }));
    panel.querySelectorAll('[data-camera]').forEach((button) => bind(button, 'click', () => {
      const viewer = runtime.viewer;
      const action = button.dataset.camera;
      if (action === 'global') {
        void focusGlobalSurface();
        return;
      }
      if (action === 'zoom-in') viewer.camera.zoomIn(clamp(viewer.camera.positionCartographic.height * 0.28, 100, 2500000));
      if (action === 'zoom-out') viewer.camera.zoomOut(clamp(viewer.camera.positionCartographic.height * 0.35, 100, 10000000));
      if (action === 'north') viewer.camera.setView({ orientation: { heading: 0, pitch: viewer.camera.pitch, roll: 0 } });
      if (action === '3d') viewer.scene.morphTo3D(1.1);
      if (action === '2d') viewer.scene.morphTo2D(1.1);
    }));
    bind(panel.querySelector('[data-measure]'), 'click', (event) => {
      measureMode = !measureMode;
      measureStart = null;
      event.currentTarget.classList.toggle('is-active', measureMode);
      if (!measureMode) {
        closeMeasure();
        return;
      }
      status('MEASURE MODE · CLICK TWO POINTS ON THE SURFACE', 'normal');
      panel.querySelector('[data-measure-status]').textContent = 'Click the first point, then the second point to measure surface distance.';
    });
    bind(panel.querySelector('[data-clear-measure]'), 'click', clearMeasureResults);
    bind(panel.querySelector('[data-minimize]'), 'click', () => {
      panel.classList.toggle('is-minimized');
      const minimized = panel.classList.contains('is-minimized');
      panel.querySelector('[data-minimize]').textContent = minimized ? '+' : '−';
      panel.querySelector('[data-minimize]').title = minimized ? 'Expand controls' : 'Minimize controls';
    });
    bind(panel.querySelector('[data-close]'), 'click', closeSurface);

    screenHandler = new Cesium.ScreenSpaceEventHandler(runtime.viewer.canvas);
    screenHandler.setInputAction((movement) => {
      if (!measureMode) return;
      const point = pickSurface(movement.position);
      if (!point) {
        status('POINT NOT AVAILABLE · TRY AN IMAGERY AREA', 'error');
        return;
      }
      const entity = runtime.viewer.entities.add({
        position: point,
        point: { pixelSize: 7, color: Cesium.Color.CYAN, outlineColor: Cesium.Color.BLACK, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY },
      });
      measurePins.push(entity);
      if (!measureStart) {
        measureStart = point;
        panel.querySelector('[data-measure-status]').textContent = 'First point set. Click the second point.';
        return;
      }
      const end = point;
      const distance = geodesicDistance(measureStart, end);
      measureLine = runtime.viewer.entities.add({
        polyline: {
          positions: [measureStart, end],
          width: 3,
          material: Cesium.Color.CYAN,
          arcType: Cesium.ArcType.GEODESIC,
          clampToGround: false,
        },
      });
      measureLines.push(measureLine);
      panel.querySelector('[data-measure-status]').textContent = 'SURFACE DISTANCE · ' + formatPlanetaryDistance(distance);
      status('MEASURED · ' + formatPlanetaryDistance(distance), 'success');
      measureStart = null;
      measureLine = null;
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    moveListener = (movement) => updateCoordinateReadout(movement.endPosition);
    screenHandler.setInputAction(moveListener, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    postRenderListener = runtime.viewer.scene.postRender.addEventListener(updateAltitudeReadout);
    controllerUnsubscribe = runtime.mapStackController?.subscribe?.((state) => {
      if (!panel) return;
      fillBasemaps();
      panel.querySelector('[data-active-map]').textContent = state.activeStack?.label || state.activeId || '—';
      if (state.lastError) status('MAP SOURCE LIMITED · ' + state.lastError, 'error');
    });
    fillBasemaps();
    fillGeeDatasets();
    const viewer = runtime.viewer;
    panel.querySelector('[data-atmosphere]').checked = viewer.scene.skyAtmosphere.show;
    panel.querySelector('[data-lighting]').checked = viewer.scene.globe.enableLighting;
    panel.querySelector('[data-grid]').checked = Boolean(viewer.dataSources.getByName(GRID_ID)[0]);
  }

  function resizeViewer() {
    const viewer = runtime?.viewer;
    if (!viewer || viewer.isDestroyed()) return;
    requestAnimationFrame(() => {
      if (!runtime?.viewer || runtime.viewer.isDestroyed()) return;
      runtime.viewer.resize?.();
      runtime.viewer.scene.requestRender?.();
      window.dispatchEvent(new Event('resize'));
    });
  }

  function openSurface() {
    if (destroyed) return;
    document.body.classList.add('gem-planet-surface-open');
    const wasOpen = Boolean(panel);
    if (!runtime?.viewer || runtime.viewer.isDestroyed()) {
      if (!panel) {
        installStyles();
        panel = buildPanel();
        document.body.append(panel);
        wirePanelWaiting();
      }
      panel.classList.remove('is-minimized');
      status(
        startupError
          ? 'MAP ENGINE ERROR · ' + startupError
          : 'INITIALIZING PLANETARY SURFACE · WAITING FOR MAP ENGINE',
        startupError ? 'error' : 'loading',
      );
      if (startupError) {
        const node = panel.querySelector('[data-search-status]');
        node.title = startupError;
      }
      return;
    }
    if (!panel) {
      installStyles();
      panel = buildPanel();
      document.body.append(panel);
      wirePanel();
    }
    panel.classList.remove('is-minimized');
    fillBasemaps();
    resizeViewer();
    if (!wasOpen) {
      if (!initialFlightDone) startInitialGlobalView();
      else startReopenedGlobalView();
    }
    updateAltitudeReadout();
  }

  function wirePanelWaiting() {
    if (!panel) return;
    bind(panel.querySelector('[data-close]'), 'click', closeSurface);
    bind(panel.querySelector('[data-minimize]'), 'click', () => {
      panel.classList.toggle('is-minimized');
      const minimized = panel.classList.contains('is-minimized');
      panel.querySelector('[data-minimize]').textContent = minimized ? '+' : '−';
    });
  }

  function closeSurface(notify = true) {
    document.body.classList.remove('gem-planet-surface-open');
    activeSearchController?.abort();
    activeSearchController = null;
    pendingPlanetSearch = null;
    disposePanelRuntime();
    if (runtime?.viewer && !runtime.viewer.isDestroyed()) {
      for (const entity of [...measurePins, ...measureLines]) runtime.viewer.entities.remove(entity);
      measurePins = [];
      measureLines = [];
      measureLine = null;
      if (gridSourceAdded) removeCoordinateGrid(runtime.viewer);
    }
    gridSourceAdded = false;
    panel?.remove();
    panel = null;
    if (notify) document.dispatchEvent(new CustomEvent('gem:close-planet-surface'));
  }

  function attachRuntime(detail) {
    if (!detail?.viewer || detail.viewer.isDestroyed()) return;
    runtime = detail;
    startupError = null;
    if (panel) {
      document.body.classList.add('gem-planet-surface-open');
      resizeViewer();
    }
    if (panel && !screenHandler) {
      // The panel was opened before Cesium finished initializing.
      removePanelHandlers();
      wirePanel();
    }
    if (panel) {
      fillBasemaps();
      if (!initialFlightDone) startInitialGlobalView();
      else if (!initialGlobalViewPromise) startReopenedGlobalView();
    }
  }

  bind(document, 'gem:open-planet-surface', openSurface, 'persistent');
  bind(document, 'gem:planet-surface-ready', (event) => attachRuntime(event.detail), 'persistent');
  bind(document, 'gem:planet-surface-error', (event) => {
    startupError = String(event.detail?.message || 'Unknown startup error').slice(0, 240);
    if (panel && !runtime?.mapStackController) {
      status('MAP ENGINE ERROR · ' + startupError, 'error');
      const node = panel.querySelector('[data-search-status]');
      if (node) node.title = startupError;
    }
  }, 'persistent');
  bind(document, 'gem:planet-surface-search', (event) => requestPlanetSearch(event.detail?.query), 'persistent');
  bind(document, 'gem:close-planet-surface', () => closeSurface(false), 'persistent');

  return {
    open: openSurface,
    activateGlobalSurface,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      activeSearchController?.abort();
      disposePanelRuntime();
      for (const remove of handlers.splice(0)) remove();
      panel?.remove();
      if (runtime?.viewer && !runtime.viewer.isDestroyed()) {
        for (const entity of [...measurePins, ...measureLines]) runtime.viewer.entities.remove(entity);
        measurePins = [];
        measureLines = [];
        measureLine = null;
        if (gridSourceAdded) removeCoordinateGrid(runtime.viewer);
      }
      gridSourceAdded = false;
      panel = null;
    },
  };
}
