import { createPopulationLayer } from '../../layers/populations/index.js';
import { overlayHost } from './overlayHost.js';

/** Wire settlement labels to the shared world-overlay renderer. */
export function createApplicationPopulations(options) {
  return createPopulationLayer({ overlay: overlayHost, ...options });
}
