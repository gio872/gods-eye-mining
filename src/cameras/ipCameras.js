import Hls from 'hls.js';
import * as Cesium from 'cesium';
import { createIpCameraSource } from './ipCameraSource.js';
import { createOnvifSource } from './onvifSource.js';
import { createOnvifDiscovery } from './onvif.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  })[char]);
}
function statusLabel(status) {
  return ({
    starting: 'CONECTANDO',
    online: 'ONLINE',
    error: 'ERROR',
    offline: 'OFFLINE',
  })[status] || 'OFFLINE';
}
function eventLabel(event) {
  if (!event) return 'EVENTOS · SIN DATOS';
  const type = event.type === 'motion' ? 'MOVIMIENTO' : event.type === 'tamper' ? 'TAMPER' : 'EVENTO';
  return `EVENTO · ${type}`;
}
function createPanel(viewer) {
  const panel = document.createElement('section');
  panel.id = 'gem-ip-cameras';
  panel.innerHTML = `
    <header class="gem-ip-header">
      <div><div class="gem-ip-kicker">GEM · SECURITY SENSOR NETWORK</div><div class="gem-ip-title">IP CAMERA CONTROL</div><div class="gem-ip-subtitle">RTSP · RTSPS · ONVIF · PTZ · HLS RELAY</div></div>
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
    #gem-ip-cameras{position:absolute;top:90px;right:calc(var(--right-rail-x,52px) + 350px);width:min(900px,calc(100vw - 430px));max-height:calc(100vh - 145px);overflow:hidden;display:flex;flex-direction:column;box-sizing:border-box;padding:14px 15px 10px;color:#eaf8fa;background:rgba(3,15,21,.97);border:1px solid rgba(44,220,226,.3);border-radius:11px;box-shadow:0 18px 55px rgba(0,0,0,.58);backdrop-filter:blur(12px);z-index:161;font-family:monospace}
    #gem-ip-cameras .gem-ip-header{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(255,255,255,.08);padding-bottom:10px}
    #gem-ip-cameras .gem-ip-kicker{font-size:8px;letter-spacing:.16em;color:#4fe2e8;font-weight:700}
    #gem-ip-cameras .gem-ip-title{font:700 19px system-ui,sans-serif;letter-spacing:.08em;margin-top:3px}
    #gem-ip-cameras .gem-ip-subtitle{font-size:8px;color:#87aeb4;letter-spacing:.1em;margin-top:3px}
    #gem-ip-cameras button{border:1px solid rgba(56,219,226,.28);background:rgba(56,219,226,.06);color:#a8eef1;border-radius:5px;padding:7px 9px;font:700 9px monospace;letter-spacing:.06em;cursor:pointer}
    #gem-ip-cameras button:disabled{opacity:.38;cursor:not-allowed}
    #gem-ip-cameras .gem-ip-close{width:28px;height:28px;font-size:18px;padding:0}
    #gem-ip-cameras input,#gem-ip-cameras select{box-sizing:border-box;width:100%;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.035);color:#eaf8fa;border-radius:5px;padding:8px;font:10px monospace}
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
    #gem-ip-cameras .gem-ip-actions,#gem-ip-cameras .gem-ip-ptz-actions{display:flex;gap:5px;margin-top:7px;flex-wrap:wrap}
    #gem-ip-cameras .gem-ip-actions button,#gem-ip-cameras .gem-ip-ptz button{padding:5px 7px;font-size:8px}
    #gem-ip-cameras .gem-ip-status{margin-left:auto;font-size:7px;color:#70eac1}
    #gem-ip-cameras .gem-ip-ptz{margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.06)}
    #gem-ip-cameras .gem-ip-ptz-title{font-size:7px;letter-spacing:.12em;color:#67dfe6}
    #gem-ip-cameras .gem-ip-dpad{display:grid;grid-template-columns:repeat(3,32px);justify-content:center;gap:4px;margin:7px 0}
    #gem-ip-cameras .gem-ip-dpad button{height:28px;padding:0}
    #gem-ip-cameras .gem-ip-ptz-status{font-size:8px;color:#8eb6bb;text-align:center;min-height:12px}
    #gem-ip-cameras .gem-ip-presets{display:grid;grid-template-columns:1fr auto;gap:5px;margin-top:6px}
    #gem-ip-cameras .gem-ip-event{margin-top:7px;padding:6px;border:1px solid rgba(255,255,255,.07);border-radius:5px;font-size:7px;letter-spacing:.08em;color:#8eb6bb}
    #gem-ip-cameras .gem-ip-event.motion{color:#f2c55d;border-color:rgba(242,197,93,.28)}
    #gem-ip-cameras .gem-ip-event.tamper{color:#ff9c8f;border-color:rgba(255,156,143,.28)}
    @media(max-width:900px){#gem-ip-cameras{left:12px;right:12px;top:105px;width:auto}.gem-ip-grid{grid-template-columns:1fr!important}.gem-ip-admin{grid-template-columns:1fr!important}.gem-ip-form{grid-template-columns:1fr!important}}
  `;
  viewer.container.append(style, panel);
  return panel;
}

export function createIpCamerasLayer({ source = createIpCameraSource() } = {}) {
  let viewer = null;
  let panel = null;
  let enabled = false;
  let destroyed = false;
  let cameras = [];
  let health = new Map();
  let sourceToken = '';
  let rowControlsListener = null;
  let dataManager = null;
  let onvifDiscovery = null;
  let eventTimer = null;
  let eventsBusy = false;
  const hls = new Map();
  const entities = new Map();
  const onvif = createOnvifSource();
  const onvifConfigs = new Map();
  const eventState = new Map();

  const token = () => sourceToken || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('gem.camera.adminToken') || '' : '');

  const setMessage = (message, error = false) => {
    const el = panel?.querySelector('.gem-ip-message');
    if (el) {
      el.textContent = message || '';
      el.style.color = error ? '#ff9c8f' : '';
    }
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
    for (const [id, entity] of entities) {
      if (!active.has(id)) {
        viewer.entities.remove(entity);
        entities.delete(id);
      }
    }
  };
  const stopHls = (id) => {
    const instance = hls.get(id);
    if (instance) {
      instance.destroy();
      hls.delete(id);
    }
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
        instance.on(Hls.Events.MANIFEST_PARSED, () => {
          video.muted = true;
          void video.play().catch(() => {});
        });
        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (data?.fatal) {
            stopHls(camera.id);
            setMessage(`Se perdió el video de ${camera.name}`, true);
          }
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
  const ptzRequest = async (camera, body) => {
    const config = onvifConfigs.get(camera.id);
    if (!config?.ptz) throw new Error('PTZ no disponible para esta cámara');
    return onvif.ptz({
      ptz: config.ptz,
      username: config.username,
      password: config.password,
      profileToken: config.profileToken,
      ...body,
    });
  };
  const refreshPtzStatus = async (camera, statusElement) => {
    try {
      const status = await ptzRequest(camera, { action: 'status' });
      statusElement.textContent = `PAN ${Number.isFinite(status.pan) ? status.pan.toFixed(2) : '—'} · TILT ${Number.isFinite(status.tilt) ? status.tilt.toFixed(2) : '—'} · ZOOM ${Number.isFinite(status.zoom) ? status.zoom.toFixed(2) : '—'}`;
    } catch (error) {
      statusElement.textContent = error?.message || 'PTZ no disponible';
    }
  };
  const buildPtz = (camera) => {
    const config = onvifConfigs.get(camera.id);
    if (!config?.ptz) return null;
    const wrap = document.createElement('div');
    wrap.className = 'gem-ip-ptz';
    const title = document.createElement('div');
    title.className = 'gem-ip-ptz-title';
    title.textContent = 'ONVIF PTZ · CONTINUOUS MOVE';
    wrap.appendChild(title);

    const dpad = document.createElement('div');
    dpad.className = 'gem-ip-dpad';
    const make = (text, vector) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text;
      button.title = 'Movimiento ONVIF';
      button.addEventListener('click', async () => {
        try {
          await ptzRequest(camera, { action: 'move', ...vector, timeoutMs: 800 });
        } catch (error) {
          setMessage(error?.message || 'Movimiento PTZ rechazado', true);
        }
      });
      return button;
    };
    dpad.append(
      document.createElement('span'),
      make('▲', { pan: 0, tilt: 0.65, zoom: 0 }),
      document.createElement('span'),
      make('◀', { pan: -0.65, tilt: 0, zoom: 0 }),
      make('■', { action: 'stop' }),
      make('▶', { pan: 0.65, tilt: 0, zoom: 0 }),
      document.createElement('span'),
      make('▼', { pan: 0, tilt: -0.65, zoom: 0 }),
      document.createElement('span'),
    );
    wrap.appendChild(dpad);

    const zoomRow = document.createElement('div');
    zoomRow.className = 'gem-ip-ptz-actions';
    const zoomMinus = make('ZOOM −', { pan: 0, tilt: 0, zoom: -0.65 });
    const zoomPlus = make('ZOOM +', { pan: 0, tilt: 0, zoom: 0.65 });
    const status = document.createElement('div');
    status.className = 'gem-ip-ptz-status';
    zoomRow.append(zoomMinus, zoomPlus);
    wrap.append(zoomRow, status);

    const presetRow = document.createElement('div');
    presetRow.className = 'gem-ip-presets';
    const select = document.createElement('select');
    select.innerHTML = '<option value="">PRESETS ONVIF</option>';
    const load = document.createElement('button');
    load.type = 'button';
    load.textContent = 'CARGAR';
    const go = document.createElement('button');
    go.type = 'button';
    go.textContent = 'IR';
    const loadPresets = async () => {
      try {
        const result = await ptzRequest(camera, { action: 'presets' });
        config.presets = Array.isArray(result.presets) ? result.presets : [];
        select.replaceChildren(new Option('PRESETS ONVIF', ''));
        for (const preset of config.presets) select.appendChild(new Option(preset.name, preset.token));
        setMessage(`${config.presets.length} preset(s) cargados: ${camera.name}`);
        return true;
      } catch (error) {
        setMessage(error?.message || 'No se pudieron cargar los presets', true);
        return false;
      }
    };
    load.addEventListener('click', () => void loadPresets());
    go.addEventListener('click', async () => {
      if (!select.value) return;
      try {
        await ptzRequest(camera, { action: 'gotoPreset', presetToken: select.value });
        setMessage(`Preset ${select.options[select.selectedIndex]?.textContent || ''} activado`);
      } catch (error) {
        setMessage(error?.message || 'No se pudo activar el preset', true);
      }
    });
    const savePreset = document.createElement('button');
    savePreset.type = 'button';
    savePreset.textContent = 'GUARDAR';
    savePreset.addEventListener('click', async () => {
      const name = window.prompt('Nombre del preset ONVIF', `GEM ${new Date().toLocaleTimeString('es-CO')}`);
      if (!name) return;
      try {
        const result = await ptzRequest(camera, { action: 'setPreset', name });
        await load.click();
        setMessage(`Preset guardado: ${name}${result.presetToken ? '' : ''}`);
      } catch (error) {
        setMessage(error?.message || 'No se pudo guardar el preset', true);
      }
    });
    const removePreset = document.createElement('button');
    removePreset.type = 'button';
    removePreset.textContent = 'BORRAR';
    removePreset.addEventListener('click', async () => {
      if (!select.value) return;
      try {
        await ptzRequest(camera, { action: 'removePreset', presetToken: select.value });
        await loadPresets();
        setMessage('Preset eliminado');
      } catch (error) {
        setMessage(error?.message || 'No se pudo eliminar el preset', true);
      }
    });
    presetRow.append(select, load, go, savePreset, removePreset);
    wrap.appendChild(presetRow);
    void refreshPtzStatus(camera, status);
    return wrap;
  };
  const render = () => {
    if (!panel) return;
    const grid = panel.querySelector('.gem-ip-grid');
    grid.replaceChildren();
    for (const camera of cameras) {
      const card = document.createElement('article');
      card.className = 'gem-ip-card';
      const video = document.createElement('video');
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      const body = document.createElement('div');
      body.className = 'gem-ip-card-body';
      const status = health.get(camera.id)?.status || camera.status || 'offline';
      body.innerHTML =
        `<div class="gem-ip-name">${esc(camera.name)} <span class="gem-ip-status">${statusLabel(status)}</span></div><div class="gem-ip-meta">${esc(camera.protocol)} · ${esc(camera.location || 'sin ubicación')}</div>`;
      const actions = document.createElement('div');
      actions.className = 'gem-ip-actions';
      const live = document.createElement('button');
      live.textContent = 'LIVE';
      live.addEventListener('click', () => void play(camera, video));
      const locate = document.createElement('button');
      locate.textContent = 'UBICAR';
      locate.disabled = !(Number.isFinite(camera.lat) && Number.isFinite(camera.lon));
      locate.addEventListener('click', () => {
        viewer?.camera?.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(camera.lon, camera.lat, 800),
        });
      });
      const remove = document.createElement('button');
      remove.textContent = 'ELIMINAR';
      remove.addEventListener('click', async () => {
        if (!confirm(`¿Eliminar ${camera.name}?`)) return;
        try {
          await source.remove(camera.id);
          onvifConfigs.delete(camera.id);
          eventState.delete(camera.id);
          await refresh();
          setMessage(`Cámara ${camera.name} eliminada`);
        } catch (error) {
          setMessage(error?.message || 'No se pudo eliminar', true);
        }
      });
      actions.append(live, locate, remove);
      body.appendChild(actions);

      const ptz = buildPtz(camera);
      if (ptz) body.appendChild(ptz);
      const event = eventState.get(camera.id);
      const eventEl = document.createElement('div');
      eventEl.className = `gem-ip-event ${event?.type || ''}`;
      eventEl.textContent = event ? `${eventLabel(event)} · ${new Date(event.timestamp).toLocaleTimeString('es-CO')} · ${event.topic || 'ONVIF'}` : 'EVENTOS · SIN ACTIVIDAD';
      body.appendChild(eventEl);

      card.append(video, body);
      grid.appendChild(card);
    }
    rowControlsListener?.();
  };
  const pollEvents = async () => {
    if (!enabled || eventsBusy || destroyed) return;
    eventsBusy = true;
    try {
      for (const camera of cameras) {
        const config = onvifConfigs.get(camera.id);
        if (!config?.events) continue;
        try {
          const result = await onvif.events({
            events: config.events,
            pullPoint: config.pullPoint,
            username: config.username,
            password: config.password,
          });
          config.pullPoint = result.pullPoint || config.pullPoint;
          const next = Array.isArray(result.events) && result.events.length ? result.events[result.events.length - 1] : null;
          if (next) eventState.set(camera.id, next);
        } catch (error) {
          config.eventError = error?.message || 'ONVIF events unavailable';
        }
      }
      render();
    } finally {
      eventsBusy = false;
    }
  };
  const stopEvents = () => {
    if (eventTimer !== null) clearInterval(eventTimer);
    eventTimer = null;
  };
  const startEvents = () => {
    stopEvents();
    if (onvifConfigs.size) {
      eventTimer = setInterval(() => void pollEvents(), 2000);
      void pollEvents();
    }
  };
  const refresh = async () => {
    try {
      const result = await source.list();
      cameras = Array.isArray(result.cameras) ? result.cameras : [];
      const activeIds = new Set(cameras.map(({ id }) => id));
      for (const id of onvifConfigs.keys()) if (!activeIds.has(id)) onvifConfigs.delete(id);
      for (const id of eventState.keys()) if (!activeIds.has(id)) eventState.delete(id);
      health = new Map(cameras.map((camera) => [camera.id, camera]));
      syncEntities();
      render();
      startEvents();
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
    source: 'GEM · ADMIN IP CAMERA NETWORK · ONVIF PTZ',
    updateInterval: 0,
    showInTogglePanel: true,
    setRowControlsListener(listener) {
      rowControlsListener = typeof listener === 'function' ? listener : null;
    },
    getRowControls() {
      const ptzCount = [...onvifConfigs.values()].filter((config) => config.ptz).length;
      return {
        info: cameras.length ? `${cameras.length} cámaras · ${ptzCount} PTZ` : 'Sin cámaras IP registradas',
        infoTitle: 'Cámaras IP administradas por GEM. ONVIF añade descubrimiento, PTZ, presets y eventos; RTSP/RTSPS se convierten a HLS mediante FFmpeg.',
      };
    },
    attachDataManager(manager) {
      dataManager = manager || null;
    },
    init(nextViewer) {
      viewer = nextViewer || null;
      if (!viewer) return false;
      if (!panel) panel = createPanel(viewer);
      const tokenInput = panel.querySelector('.gem-ip-token');
      tokenInput.value = token();
      panel.querySelector('.gem-ip-save-token').onclick = async () => {
        saveToken(tokenInput.value);
        const ok = await refresh();
        setMessage(ok ? 'Administrador autenticado' : 'Token rechazado por el servidor', !ok);
      };
      onvifDiscovery = createOnvifDiscovery({
        source: onvif,
        onAdd: async (camera, probeResult) => {
          const added = await source.add(camera);
          const createdCamera = added?.camera || {};
          if (probeResult?.ptzAvailable && probeResult.ptz) {
            onvifConfigs.set(createdCamera.id, {
              endpoint: camera.endpoint,
              username: camera.username,
              password: camera.password,
              ptz: probeResult.ptz,
              events: probeResult.events || '',
              profileToken: probeResult.selectedProfile,
              presets: probeResult.presets || [],
              pullPoint: '',
            });
          }
          await refresh();
        },
      });
      const onvifHost = document.createElement('div');
      onvifHost.className = 'gem-ip-onvif-host';
      panel.querySelector('.gem-ip-form').before(onvifHost);
      onvifDiscovery.mount(onvifHost);
      panel.querySelector('.gem-ip-add-toggle').onclick = () => {
        const form = panel.querySelector('.gem-ip-form');
        form.hidden = !form.hidden;
      };
      panel.querySelector('.gem-ip-cancel').onclick = () => {
        const form = panel.querySelector('.gem-ip-form');
        form.reset();
        form.hidden = true;
      };
      panel.querySelector('.gem-ip-close').onclick = () =>
        dataManager?.setEnabled('ip-cameras', false, { origin: 'user' });
      panel.querySelector('.gem-ip-form').onsubmit = async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        try {
          await source.add(Object.fromEntries(form.entries()));
          event.currentTarget.reset();
          event.currentTarget.hidden = true;
          setMessage('Cámara registrada');
          await refresh();
        } catch (error) {
          setMessage(error?.message || 'No se pudo registrar la cámara', true);
        }
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
      stopEvents();
      for (const id of hls.keys()) stopHls(id);
      if (panel) panel.hidden = true;
      return true;
    },
    async update() {
      if (enabled) await refresh();
      return true;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopEvents();
      for (const id of hls.keys()) stopHls(id);
      for (const entity of entities.values()) viewer?.entities?.remove(entity);
      entities.clear();
      onvifDiscovery?.destroy?.();
      onvifDiscovery = null;
      panel?.remove();
      panel = null;
      viewer = null;
      dataManager = null;
      onvifConfigs.clear();
      eventState.clear();
    },
    getStats() {
      const ptz = [...onvifConfigs.values()].filter((config) => config.ptz).length;
      return {
        count: cameras.length,
        ptz,
        events: [...onvifConfigs.values()].filter((config) => config.events).length,
        status: sourceToken ? 'admin' : 'authentication-required',
      };
    },
  };
  return Object.freeze(layer);
}
