import { createStandaloneApplication } from './standalone/application.js';
import { describeError } from './standalone/errors.js';
import { installMineralIntelligenceCenter } from './ui/mineralIntelligenceCenter.js';
import { installGemMiningModules } from './ui/gemMiningModules.js';
import { flyToGlobeView } from './locations.js';

installMineralIntelligenceCenter();

const application = createStandaloneApplication({
  googleApiKey: import.meta.env.GOOGLE_MAPS_API_KEY,
  cesiumToken: import.meta.env.CESIUM_ION_TOKEN,
  allowQaRegistration: import.meta.env.DEV,
});

application.start().then((components) => {
  const dataManager = components?.data?.dataManager;
  installMineralIntelligenceCenter({ dataManager });
  if (dataManager) installGemMiningModules(dataManager);
  const viewer = components?.scene?.viewer;
  if (viewer) {
    const openGlobal = () => {
      try {
        flyToGlobeView(viewer, { duration: 2.4 });
      } catch (error) {
        console.warn('[GEM] Global startup view unavailable:', error);
      }
    };
    window.requestAnimationFrame(openGlobal);
    // Initial share/location restoration can finish after application.start().
    // Reassert the GEM startup world view once those startup transitions settle.
    window.setTimeout(openGlobal, 3200);
  }
}).catch((error) => {
  console.error("God's Eye View initialization failed:", error);
  installMineralIntelligenceCenter();
  const message = describeError(error);
  const status = document.querySelector(".gem-start-error");
  if (status) status.textContent = message;
  else {
    const fallback = document.createElement("div");
    fallback.className = "gem-start-error";
    fallback.textContent = "GEM CORE START ERROR · " + message;
    document.body.append(fallback);
  }
});

// GEM main-screen mining modules are wired after the live data catalog is ready.
export { application };
