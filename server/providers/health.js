const STARTED_AT = new Date().toISOString();

export function healthProxy() {
  const install = (server) => {
    server.middlewares.use('/api/health', (req, res) => {
      if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'GET required' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({
        ok: true,
        service: "God's Eye Mining",
        environment: process.env.NODE_ENV || 'production',
        startedAt: STARTED_AT,
        now: new Date().toISOString(),
      }));
    });
  };
  return { name: 'health', configureServer: install, configurePreviewServer: install };
};
