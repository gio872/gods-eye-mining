import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const DEFAULT_STORE = path.resolve(process.cwd(), 'data/ip-cameras.json');
const DEFAULT_STREAM_ROOT = path.resolve(process.cwd(), '.gem-ip-camera-streams');
const TOKEN_TTL_MS = 5 * 60_000;
const MAX_CAMERAS = 64;
const ALLOWED_PROTOCOLS = new Set(['rtsp:', 'rtsps:', 'http:', 'https:']);

function safeId(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
function parseUrl(value) {
  const url = new URL(String(value || '').trim());
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) throw new Error('Camera URL must use RTSP, RTSPS, HTTP or HTTPS');
  return url;
}
function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function publicCamera(camera, health) {
  return {
    id: camera.id,
    name: camera.name,
    location: camera.location || '',
    lat: finite(camera.lat),
    lon: finite(camera.lon),
    protocol: camera.protocol,
    enabled: camera.enabled !== false,
    createdAt: camera.createdAt,
    updatedAt: camera.updatedAt,
    status: health?.status || 'offline',
    message: health?.message || '',
    lastErrorAt: health?.lastErrorAt || null,
  };
}
function readToken(req) {
  const header = String(req.headers?.authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}
function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}
function signPlaybackToken(secret, cameraId, expiresAt) {
  const payload = `${cameraId}.${expiresAt}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${expiresAt}.${sig}`;
}
function verifyPlaybackToken(secret, cameraId, token) {
  const [expires, sig] = String(token || '').split('.');
  if (!/^\\d+$/.test(expires) || !/^[a-f0-9]{64}$/i.test(sig)) return false;
  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = signPlaybackToken(secret, cameraId, expiresAt).split('.')[1];
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

async function loadStore(file) {
  try {
    const raw = await fs.readFile(file, 'utf8');
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}
async function saveStore(file, cameras) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(cameras, null, 2) + '\\n', 'utf8');
  await fs.rename(tmp, file);
}
function normalizeCamera(input, existing = {}) {
  const name = String(input?.name ?? existing.name ?? '').trim();
  const rawUrl = String(input?.url ?? existing.url ?? '').trim();
  if (!name) throw new Error('Camera name is required');
  const parsed = parseUrl(rawUrl);
  const id = safeId(input?.id || existing.id || name);
  if (!id) throw new Error('Camera id is required');
  return {
    ...existing,
    id,
    name: name.slice(0, 120),
    url: parsed.toString(),
    protocol: parsed.protocol.replace(':', '').toUpperCase(),
    location: String(input?.location ?? existing.location ?? '').trim().slice(0, 180),
    lat: finite(input?.lat ?? existing.lat),
    lon: finite(input?.lon ?? existing.lon),
    enabled: input?.enabled !== undefined ? Boolean(input.enabled) : existing.enabled !== false,
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function ipCamerasProxy({
  storeFile = process.env.GEM_IP_CAMERA_STORE || DEFAULT_STORE,
  streamRoot = process.env.GEM_IP_CAMERA_STREAM_ROOT || DEFAULT_STREAM_ROOT,
  ffmpegPath = process.env.GEM_FFMPEG_PATH || 'ffmpeg',
  adminToken = process.env.GEM_CAMERA_ADMIN_TOKEN || '',
} = {}) {
  const processes = new Map();
  const health = new Map();

  const stopProcess = async (cameraId) => {
    const entry = processes.get(cameraId);
    if (!entry) return;
    processes.delete(cameraId);
    try { entry.child.kill('SIGTERM'); } catch {}
    setTimeout(() => {
      try { if (!entry.child.killed) entry.child.kill('SIGKILL'); } catch {}
    }, 1500).unref?.();
  };

  const cleanupStreams = async () => {
    for (const id of [...processes.keys()]) await stopProcess(id);
  };

  const ensureStream = async (camera) => {
    const current = processes.get(camera.id);
    if (current && current.child.exitCode === null) return current;

    const dir = path.join(streamRoot, safeId(camera.id));
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });
    const playlist = path.join(dir, 'index.m3u8');
    const segment = path.join(dir, 'segment_%05d.ts');

    const args = [];
    if (camera.protocol === 'RTSP' || camera.protocol === 'RTSPS')
      args.push('-rtsp_transport', 'tcp');
    args.push(
      '-hide_banner', '-loglevel', 'error',
      '-i', camera.url,
      '-map', '0:v:0',
      '-an',
      '-vf', 'scale=-2:720,fps=15',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-tune', 'zerolatency',
      '-profile:v', 'main',
      '-pix_fmt', 'yuv420p',
      '-g', '30',
      '-keyint_min', '30',
      '-sc_threshold', '0',
      '-f', 'hls',
      '-hls_time', '1',
      '-hls_list_size', '4',
      '-hls_flags', 'delete_segments+omit_endlist+independent_segments+temp_file',
      '-hls_segment_filename', segment,
      playlist,
    );

    const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const entry = { child, dir, playlist, startedAt: Date.now() };
    processes.set(camera.id, entry);
    health.set(camera.id, { status: 'starting', message: 'Starting FFmpeg relay', updatedAt: Date.now() });

    child.stderr?.on('data', () => {});
    child.on('error', (error) => {
      health.set(camera.id, {
        status: 'error',
        message: error?.code === 'ENOENT' ? 'FFmpeg is not installed or GEM_FFMPEG_PATH is invalid' : 'FFmpeg relay failed',
        lastErrorAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
    child.on('exit', (code) => {
      processes.delete(camera.id);
      if (code !== 0) {
        health.set(camera.id, {
          status: 'error',
          message: 'Camera stream relay stopped',
          lastErrorAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    });
    return entry;
  };

  const install = (server) => {
    server.httpServer?.on('close', cleanupStreams);
    server.middlewares.use('/api/ip-cameras', async (req, res) => {
      try {
        const cameras = await loadStore(storeFile);
        const sourceById = new Map(cameras.map((camera) => [camera.id, camera]));
        const url = new URL(req.url || '/', 'http://localhost');
        const token = readToken(req);
        const configured = Boolean(adminToken);

        if (url.pathname === '/status' && req.method === 'GET') {
          return json(res, 200, {
            configured,
            ffmpeg: ffmpegPath,
            cameras: cameras.map((camera) => publicCamera(camera, health.get(camera.id))),
          });
        }

        if (!configured) return json(res, 503, {
          error: 'GEM_CAMERA_ADMIN_TOKEN is not configured on the server',
        });
        if (token !== adminToken) return json(res, 401, { error: 'Invalid camera administrator token' });

        if (url.pathname === '/cameras' && req.method === 'GET') {
          return json(res, 200, { cameras: cameras.map((camera) => publicCamera(camera, health.get(camera.id))) });
        }

        if (url.pathname === '/cameras' && req.method === 'POST') {
          if (cameras.length >= MAX_CAMERAS) return json(res, 409, { error: `Camera limit reached (${MAX_CAMERAS})` });
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          const camera = normalizeCamera(body);
          if (sourceById.has(camera.id)) return json(res, 409, { error: 'Camera id already exists' });
          cameras.push(camera);
          await saveStore(storeFile, cameras);
          return json(res, 201, { camera: publicCamera(camera, health.get(camera.id)) });
        }

        const match = /^\\/cameras\\/([^/]+)$/.exec(url.pathname);
        if (match) {
          const id = decodeURIComponent(match[1]);
          const index = cameras.findIndex((camera) => camera.id === id);
          if (index < 0) return json(res, 404, { error: 'Camera not found' });

          if (req.method === 'DELETE') {
            await stopProcess(id);
            cameras.splice(index, 1);
            await saveStore(storeFile, cameras);
            health.delete(id);
            return json(res, 200, { ok: true });
          }

          if (req.method === 'PATCH') {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
            const camera = normalizeCamera(body, cameras[index]);
            if (camera.id !== id && sourceById.has(camera.id)) return json(res, 409, { error: 'Camera id already exists' });
            await stopProcess(id);
            cameras[index] = camera;
            await saveStore(storeFile, cameras);
            return json(res, 200, { camera: publicCamera(camera, health.get(camera.id)) });
          }
        }

        const streamMatch = /^\\/stream\\/([^/]+)$/.exec(url.pathname);
        if (streamMatch && req.method === 'GET') {
          const id = decodeURIComponent(streamMatch[1]);
          const camera = sourceById.get(id);
          if (!camera || camera.enabled === false) return json(res, 404, { error: 'Camera unavailable' });
          const entry = await ensureStream(camera);
          const expiresAt = Date.now() + TOKEN_TTL_MS;
          const playbackToken = signPlaybackToken(adminToken, id, expiresAt);
          return json(res, 200, {
            id,
            protocol: 'HLS',
            url: `/api/ip-cameras/hls/${encodeURIComponent(id)}/index.m3u8?token=${encodeURIComponent(playbackToken)}`,
          });
        }

        const hlsMatch = /^\\/hls\\/([^/]+)\\/(.+)$/.exec(url.pathname);
        if (hlsMatch && req.method === 'GET') {
          const id = decodeURIComponent(hlsMatch[1]);
          const fileName = path.basename(decodeURIComponent(hlsMatch[2]));
          if (!verifyPlaybackToken(adminToken, id, url.searchParams.get('token'))) return json(res, 401, { error: 'Playback token expired' });
          const camera = sourceById.get(id);
          if (!camera) return json(res, 404, { error: 'Camera not found' });
          const entry = processes.get(id);
          if (!entry) return json(res, 404, { error: 'Stream relay not running' });
          const file = path.join(entry.dir, fileName);
          const resolved = path.resolve(file);
          if (!resolved.startsWith(path.resolve(entry.dir) + path.sep)) return json(res, 400, { error: 'Invalid media path' });
          try {
            const data = await fs.readFile(file);
            const type = fileName.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t';
            res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
            return res.end(data);
          } catch {
            return json(res, 404, { error: 'Media segment not ready' });
          }
        }

        return json(res, 404, { error: 'Not found' });
      } catch (error) {
        console.error('[IP Cameras]', error?.message || String(error));
        return json(res, 500, { error: 'IP camera service error' });
      }
    });
  };

  return { name: 'ip-cameras', configureServer: install, configurePreviewServer: install };
}
