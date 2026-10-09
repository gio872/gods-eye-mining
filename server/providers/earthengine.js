/**
 * GEM Google Earth Engine proxy.
 *
 * Generates a tile-ready Earth Engine map configuration without exposing
 * service-account credentials in the browser. This module is only the request
 * contract; the runtime implementation loads the official Earth Engine client
 * on the server/Pinokio host.
 */
export const GEE_GATEWAY_ENV = Object.freeze({
  project: 'GEM_EARTHENGINE_PROJECT',
  serviceAccount: 'GEM_EARTHENGINE_SERVICE_ACCOUNT',
  privateKey: 'GEM_EARTHENGINE_PRIVATE_KEY',
});

export const GEE_DEFAULT_DATASETS = Object.freeze({
  sentinel2: 'COPERNICUS/S2_SR_HARMONIZED',
  landsat: 'LANDSAT/LC09/C02/T1_L2',
  sentinel1: 'COPERNICUS/S1_GRD',
  elevation: 'COPERNICUS/DEM/GLO-30',
  worldcover: 'ESA/WorldCover/v200',
  harmony: 'HLS/HLSL30/v002',
});

export function earthEngineVisualization(dataset, options = {}) {
  const defaults = {
    sentinel2: {
      bands: ['B4', 'B3', 'B2'],
      min: 0,
      max: 3000,
    },
    landsat: {
      bands: ['SR_B4', 'SR_B3', 'SR_B2'],
      min: 7000,
      max: 18000,
    },
    sentinel1: {
      bands: ['VV'],
      min: -25,
      max: 0,
    },
    elevation: {
      bands: ['elevation'],
      min: 0,
      max: 2500,
    },
  };
  return {
    ...(defaults[dataset] || defaults.sentinel2),
    ...options,
  };
}


/**
 * Attach a local proxy placeholder. The Python gateway owns Earth Engine
 * credentials and computation; Vite exposes a same-origin route when the
 * gateway is configured.
 */
export function earthEngineProxy() {
  return {
    name: 'earthengine-proxy',
    configureServer(server) {
      const installHealth = () => {
        server.middlewares.use('/api/gee/health', async (_req, res) => {
          const configured = Boolean(
            process.env.GEM_EARTHENGINE_PROJECT &&
              process.env.GEM_EARTHENGINE_GATEWAY_PORT,
          );
          const gatewayPort = Number(
            process.env.GEM_EARTHENGINE_GATEWAY_PORT || 0,
          );
          if (!configured || !Number.isInteger(gatewayPort)) {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                ok: false,
                provider: 'earth-engine',
                configured: false,
              }),
            );
            return;
          }
          try {
            const response = await fetch(
              'http://127.0.0.1:' + gatewayPort + '/api/gee/health',
            );
            const body = await response.text();
            res.statusCode = response.status;
            res.setHeader(
              'Content-Type',
              response.headers.get('content-type') ||
                'application/json',
            );
            res.end(body);
          } catch (error) {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                ok: false,
                provider: 'earth-engine',
                configured: true,
                error: error.message,
              }),
            );
          }
        });
      };
      installHealth();
      server.middlewares.use('/api/gee/map', async (req, res) => {
        const gatewayPort = Number(
          process.env.GEM_EARTHENGINE_GATEWAY_PORT || 0,
        );
        if (!Number.isInteger(gatewayPort)) {
          res.statusCode = 503;
          res.end(JSON.stringify({ ok: false, error: 'GEE gateway is not configured' }));
          return;
        }
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', async () => {
          try {
            const response = await fetch(
              'http://127.0.0.1:' + gatewayPort + '/api/gee/map',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
              },
            );
            const payload = await response.text();
            res.statusCode = response.status;
            res.setHeader(
              'Content-Type',
              response.headers.get('content-type') ||
                'application/json',
            );
            res.end(payload);
          } catch (error) {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                ok: false,
                provider: 'earth-engine',
                error: error.message,
              }),
            );
          }
        });
      });
    },
    configurePreviewServer(server) {
      const install = this.configureServer;
      return install.call({ middlewares: server.middlewares }, server);
    },
  };
}
