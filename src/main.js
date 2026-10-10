import { createStandaloneApplication } from './standalone/application.js';
import { describeError } from './standalone/errors.js';
import { installMineralIntelligenceCenter } from './ui/mineralIntelligenceCenter.js';
import { createGlobalMineralIntelligence } from './mineral/globalMineralIntelligence.js';
import { installGemDecisionCenter } from './ui/gemDecisionCenter.js';
import { installGemAssetIntelligenceCenter } from './ui/gemAssetIntelligenceCenter.js';
import { installGemInvestorIntelligence } from './ui/gemInvestorIntelligence.js';
import { installGemWebExperience } from './ui/gemWebExperience.js';
import { installGemGlobalSurfaceWindow } from './ui/gemGlobalSurfaceWindow.js';
import { isGlobalSurfaceWindow } from './ui/gemWorkspaceRoute.js';
import { installGemPlanetSurface } from './ui/gemPlanetSurface.js';
import { detectGemLocale, applyGemLocale, getGemSupportedLanguages } from './i18n/gemLocale.js';

const dedicatedGlobalSurface = isGlobalSurfaceWindow(window.location.search);

// Product discovery lives in the main window. The dedicated Global Surface
// route deliberately keeps the classic God’s Eye View layer/navigation UI and
// does not put the product shell over the Cesium canvas.
if (dedicatedGlobalSurface) {
  installGemPlanetSurface();
  installGemGlobalSurfaceWindow();
} else {
  installMineralIntelligenceCenter();
  installGemDecisionCenter();
  installGemAssetIntelligenceCenter();
  installGemInvestorIntelligence();
  installGemWebExperience();
  installGemPlanetSurface();
}

globalThis.GEM_SUPPORTED_LANGUAGES = getGemSupportedLanguages();
detectGemLocale().then(applyGemLocale).catch(() => applyGemLocale({ locale: 'en-US', language: 'en', country: null, languageName: 'English', direction: 'ltr', source: 'fallback' }));

const application = createStandaloneApplication({
  googleApiKey: import.meta.env.GOOGLE_MAPS_API_KEY,
  cesiumToken: import.meta.env.CESIUM_ION_TOKEN,
  allowQaRegistration: import.meta.env.DEV,
  initialView: dedicatedGlobalSurface ? 'global' : 'austin',
  // The classic map window owns its own layer UI, so do not reveal the first-run
  // welcome panel on top of the live map. Provider settings still initialize.
  initializeWelcome: dedicatedGlobalSurface ? () => null : undefined,
});

let globalMineralIntelligence = null;

application
  .start()
  .then(() => {
    const scene = application.getComponents().scene || {};
    const { viewer } = scene;
    if (!viewer) return;

    if (dedicatedGlobalSurface) {
      // The application has loaded its original God’s Eye View catalog and
      // controls. Publish its real scene to optional Planet Surface tools,
      // but keep the legacy layer panels visible by default.
      document.dispatchEvent(new CustomEvent('gem:planet-surface-ready', {
        detail: {
          viewer,
          mapStackController: scene.mapStackController,
          operations: scene.operations,
          placeSearch: scene.placeSearch,
        },
      }));
      return;
    }

    installMineralIntelligenceCenter();
    globalMineralIntelligence = createGlobalMineralIntelligence({
      viewer,
      autoScan: false,
      viewportPages: 1,
      globalPages: 6,
      emitSampler:
        typeof globalThis.GEM_EMIT_L2BMIN_SAMPLER === 'function'
          ? globalThis.GEM_EMIT_L2BMIN_SAMPLER
          : undefined,
    });
    globalMineralIntelligence.mount();

    // Make the fully initialized viewer available for the user's separate
    // Global Surface window. Do not auto-hide the product home at startup.
    document.dispatchEvent(new CustomEvent('gem:planet-surface-ready', {
      detail: {
        viewer,
        mapStackController: scene.mapStackController,
        operations: scene.operations,
        placeSearch: scene.placeSearch,
      },
    }));
  })
  .catch((error) => {
    console.error('GEM initialization failed:', error);
    document.dispatchEvent(new CustomEvent('gem:planet-surface-error', {
      detail: { message: describeError(error) },
    }));
    const loaderStatus = document.querySelector(
      '#loading-screen .loader-status',
    );
    if (loaderStatus) {
      loaderStatus.textContent = `Error: ${describeError(error)}`;
      loaderStatus.style.color = '#ff4444';
    }
  });
application.subscribe((state) => {
  if (state.status === 'destroyed') {
    globalMineralIntelligence?.destroy();
    globalMineralIntelligence = null;
  }
});

export { application, globalMineralIntelligence };
