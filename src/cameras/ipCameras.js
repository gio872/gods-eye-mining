import Hls from 'hls.js';
import * as Cesium from 'cesium';
import { createIpCameraSource } from './ipCameraSource.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
}
function statusLabel(status) {
  return ({ starting: 'CONECTANDO', online: 'ONLINE', error: 'ERROR', offline: 'OFFLINE' })[status] || 'OFFLINE';
}
function createPanel(viewer, source, getToken) {
  const panel = document.createElement('section');
  panel.id = 'gem-ip-cameras';
  panel.innerHTML = `
    <header class="gem-ip-header">
      <div><div class="gem-ip-kicker">GEM · SECURITY SENSOR NETWORK</div><div class="gem-ip-title">IP CAMERA CONTROL</div><div class="gem-ip-subtitle">RTSP · RTSPS · HTTP · HLS RELAY</div></div>
      <button type="button" class="gem-ip-close" aria-label="Cerrar">×</button>
    </header>
    <div class="gem-ip-admin">
      <input class="gem-ip-token" type="password" autocomplete="off" placeholder="Token de administrador">
      <button class="gem-ip-save-token" type="button">AUTENTICAR</button>
      <button class="gem-ip-add-toggle" type="button">+ CÁMARA</button>
    </div>
    <form class="gem-ip-form" hidden>
      <input name="name" required maxlength="120" placeholder="Nombre de la cámara">
      <input name="url" required placeholder="rtsp://usuario:clave@192.168.1.50:554/stream">
      <input name="location" maxlength="180" placeholder="Ubicación / instalación">
      <div class="gem-ip-coords"><input name="lat" type="number" step="any" placeholder="Latitud"><input name="lon" type="number" step="any" placeholder="Longitud"></div>
      <div><button type="submit">AGREGAR CÁMARA</button><button class="gem-ip-cancel" type="button">CANCELAR</button></div>
    </form>
    <div class="gem-ip-message"></div>
    <div class="gem-ip-grid"></div>
  `;
  const style = document.createElement('style');
  style.textContent = `
    #gem-ip-cameras{position:absolute;top:90px;right:calc(var(--right-rail-x,52px) + 350px);width:min(760px,calc(100vw - 430px));max-height:calc(100vh - 145px);overflow:hidden;display:flex;flex-direction:column;box-sizing:border-box;padding:14px 15px 10px;color:#eaf8fa;background:rgba(3,15,21,.97);border:1px solid rgba(44,220,226,.3);border-radius:11px;box-shadow:0 18px 55px rgba(0,0,0,.58);backdrop-filter:blur(12px);z-index:161;font-family:monospace}
    #gem-ip-cameras .gem-ip-header{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:10px}
    #gem-ip-cameras .gem-ip-kicker{font-size:8px;letter-spacing:.16em;color:#4fe2e8;font-weight:700}
    #gem-ip-cameras .gem-ip-title{font:700 19px system-ui,sans-serif;letter-spacing:.08em;margin-top:3px}
    #gem-ip-cameras .gem-ip-subtitle{font-size:8px;color:#87aeb4;letter-spacing:.1em;margin-top:3px}
    #gem-ip-cameras button{border:1px solid rgba(56,219,226,.28);background:rgba(56,219,226,.06);color:#a8eef1;border-radius:5px;padding:7px 9px;font:700 9px monospace;letter-spacing:.06em;cursor:pointer}
    #gem-ip-cameras .gem-ip-close{width:28px;height:28px;font-size:18px;padding:0}
    #gem-ip-cameras input{box-sizing:border-box;width:100%;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.035);color:#eaf8fa;border-radius:5px;padding:8px;font:10px monospace}
    #gem-ip-cameras .gem-ip-admin{display:grid;grid-template-columns:1fr auto auto;gap:7px;padding:10px 0}
    #gem-ip-cameras .gem-ip-form{display:grid;grid-template-columns:1fr 1.5fr 1fr;gap:7px;padding:8px 0 10px;border-bottom:1px solid rgba(255,255,255,.08)}
    #gem-ip-cameras .gem-ip-form>div{grid-column:1/-1;display:flex;gap:7px}
    #gem-ip-cameras .gem-ip-coords{display:grid!important;grid-template-columns:1fr 1fr;gap:7px}
    #gem-ip-cameras .gem-ip-message{min-height:17px;color:#91b5ba;font-size:9px;padding:2px 0 7px}
    #gem-ip-cameras .gem-ip-grid{min-height:0;overflow:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding-right:2px}
    #gem-ip-cameras .gem-ip-card{border:1px solid rgba(255,255,255,.08);border-radius:8px;overflow:hidden;background:rgba(255,255,255,.025)}
    #gem-ip-cameras video{display:block;width:100%;aspect-ratio:16/9;background:#020608;object-fit:contain}
    #gem-ip-cameras .gem-ip-card-body{padding:8px}
    #gem-ip-cameras .gem-ip-name{font-weight:700;font-size:11px}
    #gem-ip-cameras .gem-ip-meta{font-size:8px;color:#76969b;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #gem-ip-cameras .gem-ip-actions{display:flex;gap:5px;margin-top:7px}
    #gem-ip-cameras .gem-ip-actions button{padding:5px 7px;font-size:8px}
    #gem-ip-cameras .gem-ip-status{margin-left:auto;font-size:7px;color:#70eac1}
    @media(max-width:900px){#gem-ip-cameras{left:12px;right:12px;top:105px;width:auto}.gem-ip-grid{grid-template-columns:1fr!important}}
  `;
  viewer.container.append(style, panel);
  return panel;
}

export function createIpCamerasLayer({
  source = createIpCameraSource(),
} = {}) {
  let viewer = null;
  let panel = null;
  let enabled = false;
  let destroyed = false;
  let cameras = [];
  let health = new Map();
  let sourceToken = '';
  let rowControlsListener = null;
  let dataManager = null;
  const hls = new Map();
  const entities = new Map();

  const token = () => sourceToken || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('gem.camera.adminToken') || '' : '');
  const setMessage = (message, error = false) => {
    const el = panel?.querySelector('.gem-ip-message');
    if (el) { el.textContent = message || ''; el.style.color = error ? '#ff9c8f' : ''; }
  };
  const saveToken = (value) => {
    sourceToken = String(value || '').trim();
    if (typeof sessionStorage !== 'undefined') {
      if (sourceToken) sessionStorage.setItem('gem.camera.adminToken', sourceToken);
      else sessionStorage.removeItem('gem.camera.adminToken');
    }
  };
  const syncEntities = () => {
    if (!viewer) return;
    const active = new Set();
    for (const camera of cameras) {
      if (!Number.isFinite(camera.lat) || !Number.isFinite(camera.lon)) continue;
      active.add(camera.id);
      let entity = entities.get(camera.id);
      if (!entity) {
        entity = viewer.entities.add({
          id: `gem-ip-camera:${camera.id}`,
          position: Cesium.Cartesian3.fromDegrees(camera.lon, camera.lat),
          point: { pixelSize: 10, color: Cesium.Color.CYAN, outlineColor: Cesium.Color.BLACK, outlineWidth: 2 },
          properties: { ipCameraId: camera.id },
          label: { text: camera.name, font: '11px monospace', pixelOffset: new Cesium.Cartesian2(0, -18), showBackground: true, backgroundColor: Cesium.Color.fromAlpha(Cesium.Color.BLACK, .65) },
        });
        entities.set(camera.id, entity);
      } else {
        entity.position = Cesium.Cartesian3.fromDegrees(camera.lon, camera.lat);
        entity.label.text = camera.name;
      }
    }
    for (const [id, entity] of entities) if (!active.has(id)) { viewer.entities.remove(entity); entities.delete(id); }
  };
  const stopHls = (id) => {
    const instance = hls.get(id);
    if (instance) { instance.destroy(); hls.delete(id); }
  };
  const play = async (camera, video) => {
    stopHls(camera.id);
    try {
      const result = await source.stream(camera.id);
      const url = result.url;
      if (Hls.isSupported()) {
        const instance = new Hls({ lowLatencyMode: true, liveSyncDurationCount: 2, maxLiveSyncPlaybackRate: 1.2 });
        instance.loadSource(url);
        instance.attachMedia(video);
        instance.on(Hls.Events.MANIFEST_PARSED, () => { video.muted = true; void video.play().catch(() => {}); });
        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (data?.fatal) { stopHls(camera.id); setMessage(`Se perdió el video de ${camera.name}`, true); }
        });
        hls.set(camera.id, instance);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.muted = true;
        await video.play().catch(() => {});
      } else {
        throw new Error('El navegador no soporta HLS');
      }
    } catch (error) {
      setMessage(error?.message || 'No se pudo iniciar el video', true);
    }
  };
  const render = () => {
    if (!panel) return;
    const grid = panel.querySelector('.gem-ip-grid');
    grid.replaceChildren();
    for (const camera of cameras) {
      const card = document.createElement('article');
      card.className = 'gem-ip-card';
      const video = document.createElement('video');
      video.controls = true; video.autoplay = true; video.playsInline = true; video.muted = true;
      const body = document.createElement('div');
      body.className = 'gem-ip-card-body';
      const status = health.get(camera.id)?.status || camera.status || 'offline';
      body.innerHTML = `<div class="gem-ip-name">${esc(camera.name)} <span class="gem-ip-status">${statusLabel(status)}</span></div><div class="gem-ip-meta">${esc(camera.protocol)} · ${esc(camera.location || 'sin ubicación')}</div>`;
      const actions = document.createElement('div');
      actions.className = 'gem-ip-actions';
      const live = document.createElement('button'); live.textContent = 'LIVE'; live.addEventListener('click', () => void play(camera, video));
      const locate = document.createElement('button'); locate.textContent = 'UBICAR'; locate.disabled = !(Number.isFinite(camera.lat) && Number.isFinite(camera.lon)); locate.addEventListener('click', () => {
        viewer?.camera?.flyTo({ destination: Cesium.Cartesian3.fromDegrees(camera.lon, camera.lat, 800) });
      });
      const remove = document.createElement('button'); remove.textContent = 'ELIMINAR'; remove.addEventListener('click', async () => {
        if (!confirm(`¿Eliminar ${camera.name}?`)) return;
        try { await source.remove(camera.id); await refresh(); setMessage(`Cámara ${camera.name} eliminada`); } catch (error) { setMessage(error?.message || 'No se pudo eliminar', true); }
      });
      actions.append(live, locate, remove); body.appendChild(actions); card.append(video, body); grid.appendChild(card);
      // Live relay starts only when the operator presses LIVE; this avoids spawning one FFmpeg process per registered camera.
    }
    rowControlsListener?.();
  };
  const refresh = async () => {
    try {
      const result = await source.list();
      cameras = Array.isArray(result.cameras) ? result.cameras : [];
      health = new Map(cameras.map((camera) => [camera.id, camera]));
      syncEntities();
      render();
      return true;
    } catch (error) {
      setMessage(error?.message || 'Autenticación requerida', true);
      return false;
    }
  };
  const layer = {
    id: 'ip-cameras',
    name: 'Cámaras IP',
    icon: '◉',
    source: 'GEM · ADMIN IP CAMERA NETWORK',
    updateInterval: 0,
    showInTogglePanel: true,
    setRowControlsListener(listener) { rowControlsListener = typeof listener === 'function' ? listener : null; },
    getRowControls() {
      return {
        info: cameras.length ? `${cameras.length} cámaras · administración activa` : 'Sin cámaras IP registradas',
        infoTitle: 'Cámaras IP administradas por GEM. RTSP/RTSPS se convierten a HLS en el servidor mediante FFmpeg.',
      };
    },
    attachDataManager(manager) { dataManager = manager || null; },
    init(nextViewer) {
      viewer = nextViewer || null;
      if (!viewer) return false;
      if (!panel) panel = createPanel(viewer, source, token);
      const tokenInput = panel.querySelector('.gem-ip-token');
      tokenInput.value = token();
      panel.querySelector('.gem-ip-save-token').onclick = async () => {
        saveToken(tokenInput.value);
        const ok = await refresh();
        setMessage(ok ? 'Administrador autenticado' : 'Token rechazado por el servidor', !ok);
      };
      panel.querySelector('.gem-ip-add-toggle').onclick = () => { panel.querySelector('.gem-ip-form').hidden = !panel.querySelector('.gem-ip-form').hidden; };
      panel.querySelector('.gem-ip-cancel').onclick = () => { panel.querySelector('.gem-ip-form').reset(); panel.querySelector('.gem-ip-form').hidden = true; };
      panel.querySelector('.gem-ip-close').onclick = () => dataManager?.setEnabled('ip-cameras', false, { origin: 'user' });
      panel.querySelector('.gem-ip-form').onsubmit = async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        try {
          await source.add(Object.fromEntries(form.entries()));
          event.currentTarget.reset(); event.currentTarget.hidden = true;
          setMessage('Cámara registrada');
          await refresh();
        } catch (error) { setMessage(error?.message || 'No se pudo registrar la cámara', true); }
      };
      return true;
    },
    enable(nextViewer) {
      viewer = nextViewer || viewer;
      enabled = true;
      if (panel) panel.hidden = false;
      void refresh();
      return true;
    },
    disable() {
      enabled = false;
      for (const id of hls.keys()) stopHls(id);
      if (panel) panel.hidden = true;
      return true;
    },
    async update() { if (enabled) await refresh(); return true; },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const id of hls.keys()) stopHls(id);
      for (const entity of entities.values()) viewer?.entities?.remove(entity);
      entities.clear();
      panel?.remove(); panel = null; viewer = null; dataManager = null;
    },
    getStats() { return { count: cameras.length, status: sourceToken ? 'admin' : 'authentication-required' }; },
  };
  return Object.freeze(layer);
}
