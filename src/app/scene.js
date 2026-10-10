import { createApplicationOperations } from './operations.js';
import { isEarthEngineReady } from '../maps/geeReadiness.js';
import { activateInitialMapStack } from '../maps/initialStack.js';
import * as Cesium from 'cesium';
import {
  createApplicationViewer,
  installTrackpadPinchZoom,
} from '../app/viewer.js';
import { registerDataCredits } from '../data/dataCredits.js';
import { configureCreditKeyboardAccess } from '../creditKeyboard.js';
import { MapStackController } from '../mapStackController.js';
import { loadPhotorealisticTileset } from '../mapStartup.js';
import { initLogoGaze } from '../logoGaze.js';
import {
  uninstallRenderGovernor,
  governorRequestRender,
} from '../renderGovernor.js';
import { describeError } from './errors.js';


/** Construct the application globe using the caller's local configuration. */
export async function createApplicationScene({
  requestServices,
  googleApiKey,
  cesiumToken,
  credits,
  MapController = MapStackController,
  mapOptions = {},
  loaderStatus,
  signal,
  defer,
  skipPhotoreal = false,
}) {
  const operations = createApplicationOperations({
    requests: requestServices,
    signal,
  });
  defer(initLogoGaze());
  const previousKey = window.__GOOGLE_MAPS_API_KEY__;
  if (googleApiKey) {
    window.__GOOGLE_MAPS_API_KEY__ = googleApiKey;
    defer(() => {
      if (window.__GOOGLE_MAPS_API_KEY__ !== googleApiKey) return;
      if (previousKey === undefined) delete window.__GOOGLE_MAPS_API_KEY__;
      else window.__GOOGLE_MAPS_API_KEY__ = previousKey;
    });
  }
  loaderStatus.textContent = 'Configuring viewer...';
  // Provider attribution stays visible, including clean-view and recording.
  const creditContainer = document.createElement('div');
  creditContainer.id = 'cesium-credits';
  document.body.appendChild(creditContainer);
  defer(() => creditContainer.remove());
  const viewer = createApplicationViewer({
    container: 'cesiumContainer',
    creditContainer,
  });
  // The ellipsoid must remain visible while remote map sources initialize.
  viewer.scene.globe.show = true;
  viewer.scene.requestRender?.();
  defer(() => {
    uninstallRenderGovernor(viewer);
    if (!viewer.isDestroyed()) viewer.destroy();
  });
  defer(installTrackpadPinchZoom(viewer));
  registerDataCredits(viewer, credits);
  configureCreditKeyboardAccess(document);
  // Publish after registering cleanup, but before the first asynchronous
  // provider/readiness probe. Planet is useful even while other subsystems load.
  viewer.scene.globe.show = true;
  viewer.scene.requestRender?.();
  const earlySurfaceDetail = { viewer, operations };
  window.dispatchEvent(new CustomEvent('gem:planet-surface-ready', { detail: earlySurfaceDetail }));
  // The dedicated planetary surface needs global imagery, not city-level 3D tiles.
  // Publish the live globe before any provider probe so slow credentials/network
  // cannot leave the dedicated window indefinitely black.
  document.dispatchEvent(new CustomEvent('gem:planet-surface-ready', { detail: earlySurfaceDetail }));
  const geeReady = await isEarthEngineReady(signal);
  let photoreal = { tileset: null, route: null, errors: [] };
  if (geeReady) {
    loaderStatus.textContent = 'Google Earth Engine ready — loading global EO...';
  } else {
    loaderStatus.textContent =
      googleApiKey || cesiumToken
        ? 'Loading Google 3D Tiles...'
        : 'Loading the keyless globe...';
    if (!skipPhotoreal) {
      photoreal = await loadPhotorealisticTileset(Cesium, {
        googleApiKey,
        cesiumToken,
      });
    }
  }
  const tileset = photoreal.tileset;
  // A provider can finish after cancellation; retain ownership of its result.
  defer(() => {
    if (tileset && !tileset.isDestroyed()) {
      if (!viewer.scene.primitives.remove(tileset)) tileset.destroy();
    }
  });
  signal.throwIfAborted();
  if (tileset) {
    viewer.scene.primitives.add(tileset);
    // NOTE: Cesium World Terrain intentionally disabled — conflicts with Google 3D Tiles at high zoom.
    // Google Photorealistic 3D Tiles provide their own terrain/elevation.
    viewer.scene.globe.show = false;
    console.info(`[Init] Google 3D Tiles loaded via ${photoreal.route}.`);
  } else {
    if (photoreal.errors.length) {
      const tileError = photoreal.errors.at(-1);
      console.warn(
        '[Init] Google 3D Tiles unavailable, using the keyless globe:',
        tileError,
      );
      const tileErrorDetail = describeError(tileError);
      loaderStatus.textContent = `Google 3D Tiles unavailable (${tileErrorDetail}). Loading the keyless globe...`;
    }
    viewer.scene.globe.show = true;
  }

  loaderStatus.textContent = 'Initializing systems...';

  const mapStackController = new MapController(viewer, {
    requestRender: governorRequestRender,
    ...mapOptions,
    googleTileset: tileset,
    cesiumToken,
    geeAvailable: geeReady,
    initialStack: geeReady ? 'gee-global-eo' : photoreal.tileset ? 'photoreal' : 'esri-imagery',
    // Task 5 (height-datum fix): rebroadcast stack changes as a window
    // CustomEvent so data layers (CCTV per-regime ground resolution) can
    // react without coupling MapStackController to layer modules. Fires on
    // 'switching'/'ready'/'error'; listeners derive the surface regime from
    // live scene state, so intermediate emissions are harmless.
    onChange: (state) => {
      window.dispatchEvent(
        new CustomEvent('gev:map-stack-changed', { detail: state }),
      );
    },
    onError: (message) => console.warn('[MapStack]', message),
  });
  defer(() => mapStackController.destroy());
  const requestedInitialStack = geeReady
    ? 'gee-global-eo'
    : photoreal.tileset
      ? 'photoreal'
      : 'esri-imagery';
  const initialActivation = await activateInitialMapStack(
    mapStackController,
    requestedInitialStack,
  );
  if (initialActivation.usedFallback) {
    console.warn(
      '[Init] Earth Engine responded healthy but map imagery did not activate; using Esri satellite imagery.',
      initialActivation.reason,
    );
  }

  signal.throwIfAborted();
  return { viewer, tileset, mapStackController, operations };
}
