import { createStandaloneCatalog } from './catalog.js';
import { createStandalonePlaceSearch } from './placeSearch.js';
import { CITY_POIS } from '../locations.js';
import { createApplication } from '../app/application.js';
import { createStandaloneScene } from './scene.js';
import { createStandaloneControls } from './controls.js';
import { createStandaloneData } from './data.js';
import { createStandaloneTools } from './tools.js';

// The existing controls and layer catalog contain page-scoped state.
let constructed = false;

/** Compose the standalone application once per page. Reload to start again. */
export function createStandaloneApplication({
  googleApiKey,
  cesiumToken,
  geospatial = {},
  voice = {},
  allowQaRegistration = false,
}) {
  if (constructed)
    throw new Error('The standalone application already owns this page');
  constructed = true;
  const loadingScreen = document.getElementById('loading-screen');
  const loaderStatus = loadingScreen.querySelector('.loader-status');
  let placeSearch;
  let catalog;
  return createApplication({
    createScene: async (context) => {
      placeSearch = createStandalonePlaceSearch({
        // The bundled city and landmark data the offline name provider reads.
        // The search package takes it as plain data rather than importing it,
        // so it stays free of application state.
        presets: CITY_POIS,
        ...geospatial,
        resolveApiKey: () => googleApiKey,
        signal: context.signal,
      });
      const scene = await createStandaloneScene({
        ...context,
        googleApiKey,
        cesiumToken,
        loaderStatus,
      });
      // Publish the live globe as soon as its scene and basemap controller
      // are ready. Do not wait for every data/layer/tool subsystem: the Planet
      // workspace can open while those independent systems continue starting.
      scene.placeSearch = placeSearch;
      window.dispatchEvent(new CustomEvent('gem:planet-surface-ready', {
        detail: {
          viewer: scene.viewer,
          mapStackController: scene.mapStackController,
          operations: scene.operations,
          placeSearch,
        },
      }));
      catalog = createStandaloneCatalog({
        nepalBoundaryResolver: (signal) =>
          scene.operations.annotationResolver.resolveRegionRingForQuery(
            'Nepal',
            signal,
            placeSearch,
            // The locator draws the border whenever it arrives.
            { budgetMs: Infinity },
          ),
        signal: context.signal,
        surface: scene.operations.surface,
      });
      return scene;
    },
    createControls: (context) =>
      createStandaloneControls({
        ...context,
        loaderStatus,
        placeSearch,
        catalog,
      }),
    createData: (context) =>
      createStandaloneData({ ...context, allowQaRegistration, catalog }),
    createTools: (context) =>
      createStandaloneTools({ ...context, loadingScreen, placeSearch, voice }),
  });
}
