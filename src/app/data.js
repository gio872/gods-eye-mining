import { LayerLifecycle } from '../data/lifecycle.js';
import { LayerPresentation } from './layerPresentation.js';
import { createCyberSonarScene } from '../cyberSonarScene.js';

const MINING_DEFAULT_LAYER_IDS = Object.freeze([
  'metal-markets',
  'anm-mining-cadastre',
  'anm-free-areas',
  'anm-area-intelligence',
  'geophysics-subsurface',
  'global-precious-metals',
  'global-satellite-mining',
  'gem-prospectivity',
  'intelligence-graph',
  'mining-economics',
  'critical-minerals',
  'entity-intelligence',
  'mineral-trade-intelligence',
]);

/** Register the application layer catalog before allowing state restoration. */
export function createApplicationData({
  scene: { viewer, mapStackController },
  controls: { styleManager },
  catalog,
  allowQaRegistration,
  onData,
  defer,
}) {
  // Initialize data layer manager
  const dataManager = new LayerLifecycle(viewer, {
    allowQaRegistration,
  });
  defer(async () => {
    await dataManager.destroyAll();
    if (dataManager.layers.size)
      throw new Error(
        `Data layers could not be destroyed: ${[...dataManager.layers.keys()].join(', ')}`,
      );
  });
  const presentation = new LayerPresentation(dataManager, {
    weatherClock: catalog?.weatherClock,
  });
  defer(() => presentation.destroy());
  onData?.(dataManager);
  if (!catalog?.layers || !catalog?.metadata)
    throw new TypeError('An application layer catalog is required');
  for (const layer of catalog.layers) dataManager.register(layer);
  for (const layer of catalog.layers) layer.attachDataManager?.(dataManager);
  for (const layer of catalog.layers)
    layer.attachMapStackController?.(mapStackController);
  // Restoration starts only after the caller's complete registry is sealed.
  dataManager.finalizeRegistrations(catalog.metadata);
  if (allowQaRegistration) {
    window.__gevQaRegisterLayer = (targetManager, layerModule) => {
      if (targetManager !== dataManager)
        throw new Error('QA layer manager mismatch');
      return dataManager.registerForQa(layerModule);
    };
    window.__gevQaUnregisterLayer = (targetManager, layerId) => {
      if (targetManager !== dataManager)
        throw new Error('QA layer manager mismatch');
      return dataManager.unregisterForQa(layerId);
    };
    const register = window.__gevQaRegisterLayer;
    const unregister = window.__gevQaUnregisterLayer;
    defer(() => {
      if (window.__gevQaRegisterLayer === register)
        delete window.__gevQaRegisterLayer;
      if (window.__gevQaUnregisterLayer === unregister)
        delete window.__gevQaUnregisterLayer;
    });
  }
  presentation.mount(document.getElementById('data-toggles'));
  styleManager.attachDataManager(dataManager);
  // Settlement labels are core cartographic context in Mining Mode. They are
  // local-only and therefore do not enter share-link state.
  void dataManager
    .setEnabled('population-places', true, { origin: 'programmatic' })
    .catch((error) =>
      console.warn('[Data] population-places default enable failed:', error),
    );

  // Mining Mode opens as a complete, synchronized module. The lifecycle manager
  // owns the real ON state; UI toggles are therefore rendered from settled
  // layer state instead of being visually forced.
  void (async () => {
    for (const layerId of MINING_DEFAULT_LAYER_IDS) {
      if (!dataManager.layers.has(layerId)) continue;
      try {
        await dataManager.setEnabled(layerId, true, { origin: 'programmatic' });
      } catch (error) {
        console.warn('[Data] Mining default enable failed:', layerId, error);
      }
    }
  })();
  defer(createCyberSonarScene(viewer, dataManager));

  return { dataManager, catalog, presentation };
}
