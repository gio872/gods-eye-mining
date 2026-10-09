import { createStandaloneApplication } from './standalone/application.js';
import { describeError } from './standalone/errors.js';
import { installMineralIntelligenceCenter } from './ui/mineralIntelligenceCenter.js';
import { createGlobalMineralIntelligence } from './mineral/globalMineralIntelligence.js';
import { installGemDecisionCenter } from './ui/gemDecisionCenter.js';
import { installGemAssetIntelligenceCenter } from './ui/gemAssetIntelligenceCenter.js';
import { installGemInvestorIntelligence } from './ui/gemInvestorIntelligence.js';
import { installGemWebExperience } from './ui/gemWebExperience.js';
import { installGemPlanetSurface } from './ui/gemPlanetSurface.js';
import { detectGemLocale, applyGemLocale, getGemSupportedLanguages } from './i18n/gemLocale.js';

installMineralIntelligenceCenter();
installGemDecisionCenter();
installGemAssetIntelligenceCenter();
installGemInvestorIntelligence();
installGemWebExperience();
installGemPlanetSurface();

globalThis.GEM_SUPPORTED_LANGUAGES = getGemSupportedLanguages();
detectGemLocale().then(applyGemLocale).catch(() => applyGemLocale({ locale: 'en-US', language: 'en', country: null, languageName: 'English', direction: 'ltr', source: 'fallback' }));

const application = createStandaloneApplication({
  googleApiKey: import.meta.env.GOOGLE_MAPS_API_KEY,
  cesiumToken: import.meta.env.CESIUM_ION_TOKEN,
  allowQaRegistration: import.meta.env.DEV,
});

let globalMineralIntelligence = null;

application
  .start()
  .then(() => {
    installMineralIntelligenceCenter();
    const scene = application.getComponents().scene || {};
    const { viewer } = scene;
    document.dispatchEvent(new CustomEvent('gem:planet-surface-ready', {
      detail: {
        viewer,
        mapStackController: scene.mapStackController,
        operations: scene.operations,
        placeSearch: scene.placeSearch,
      },
    }));
    if (viewer) {
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
    }
  })
  .catch((error) => {
    console.error('GEM initialization failed:', error);
    const loaderStatus = document.querySelector(
      '#loading-screen .loader-status',
    );
    loaderStatus.textContent = `Error: ${describeError(error)}`;
    loaderStatus.style.color = '#ff4444';
  });

application.subscribe((state) => {
  if (state.status === 'destroyed') {
    globalMineralIntelligence?.destroy();
    globalMineralIntelligence = null;
  }
});

export { application, globalMineralIntelligence };
