import { createStandaloneApplication } from './standalone/application.js';
import { describeError } from './standalone/errors.js';
import { installMineralIntelligenceCenter } from './ui/mineralIntelligenceCenter.js';
import { flyToGlobeView } from './locations.js';

installMineralIntelligenceCenter();

const application = createStandaloneApplication({
  googleApiKey: import.meta.env.GOOGLE_MAPS_API_KEY,
  cesiumToken: import.meta.env.CESIUM_ION_TOKEN,
  allowQaRegistration: import.meta.env.DEV,
});

application.start().then((components) => {
  installMineralIntelligenceCenter();
  const viewer = components?.scene?.viewer;
  if (viewer) {
    window.setTimeout(() => {
      try {
        flyToGlobeView(viewer, { duration: 2.8 });
      } catch (error) {
        console.warn('[GEM] Global startup view unavailable:', error);
      }
    }, 350);
  }
}).catch((error) => {
  console.error("GEM Mineral Intelligence initialization failed:", error);
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

export { application };
