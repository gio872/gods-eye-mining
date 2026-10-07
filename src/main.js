import { createStandaloneApplication } from './standalone/application.js';
import { describeError } from './standalone/errors.js';
import { installMineralIntelligenceCenter } from './ui/mineralIntelligenceCenter.js';

installMineralIntelligenceCenter();

const application = createStandaloneApplication({
  googleApiKey: import.meta.env.GOOGLE_MAPS_API_KEY,
  cesiumToken: import.meta.env.CESIUM_ION_TOKEN,
  allowQaRegistration: import.meta.env.DEV,
});

application.start().then(() => {
  installMineralIntelligenceCenter();
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
