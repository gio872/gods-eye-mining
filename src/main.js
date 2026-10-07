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
    const forceGlobalWorldView = () => {
      try {
        viewer.camera.cancelFlight();
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(0, 18, 18000000),
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-90),
            roll: 0,
          },
        });
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(0, 18, 18000000),
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-90),
            roll: 0,
          },
          duration: 2.2,
        });
      } catch (error) {
        console.warn('[GEM] Global startup view unavailable:', error);
      }
    };
    // Force the initial camera to the full Earth rather than restoring a prior city.
    forceGlobalWorldView();
    window.setTimeout(forceGlobalWorldView, 1200);
    window.setTimeout(forceGlobalWorldView, 3200);
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
