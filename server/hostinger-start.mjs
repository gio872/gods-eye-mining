#!/usr/bin/env node
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);
process.env.NODE_ENV ||= 'production';

const port = Number.parseInt(process.env.PORT || '4173', 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');
const host = process.env.HOST || '0.0.0.0';

if (!existsSync(path.join(ROOT, 'dist', 'index.html'))) throw new Error('Production build not found in dist/. Run npm run build before npm start.');

const { preview } = await import('vite');
const server = await preview({ root: ROOT, host, port, strictPort: true });
server.printUrls();
console.log('[Gods Eye Mining] Production server ready on ' + host + ':' + port);

const shutdown = async (signal) => {
  console.log('[Gods Eye Mining] ' + signal + ' received; shutting down.');
  await server.httpServer?.close?.();
  process.exit(0);
};

for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void shutdown(signal); });
