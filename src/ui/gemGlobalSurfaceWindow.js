import { buildGemHomeUrl } from './gemWorkspaceRoute.js';

export function installGemGlobalSurfaceWindow() {
  if (document.querySelector('.gem-global-surface-toolbar')) return;
  document.title = 'TerraQueen GEM — Global Surface';
  document.body.classList.add('gem-global-surface-window');
  document.documentElement.dataset.gemWorkspace = 'global-surface';

  const toolbar = document.createElement('section');
  toolbar.className = 'gem-global-surface-toolbar';
  toolbar.setAttribute('aria-label', 'GEM Global Surface controls');
  toolbar.innerHTML = `
    <div class="ggs-brand"><span>G</span><div><b>TERRAQUEEN GEM</b><small>GLOBAL SURFACE · PLANETARY VIEWER</small></div></div>
    <div class="ggs-state" data-global-surface-state role="status" aria-live="polite">INITIALIZING GLOBAL VIEWER…</div>
    <div class="ggs-actions">
      <button type="button" data-global-surface-tools>MAP TOOLS</button>
      <button type="button" data-global-surface-home>GEM HOME ↗</button>
    </div>
  `;
  const style = document.createElement('style');
  style.id = 'gem-global-surface-window-style';
  style.textContent = `
    .gem-global-surface-toolbar{position:fixed;left:14px;top:14px;z-index:18000;display:flex;align-items:center;gap:14px;max-width:calc(100vw - 28px);padding:9px 11px;border:1px solid rgba(104,232,244,.28);border-radius:13px;background:rgba(4,12,19,.91);backdrop-filter:blur(18px);box-shadow:0 16px 48px rgba(0,0,0,.32);color:#eaf8fb;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
    .ggs-brand{display:flex;align-items:center;gap:9px;min-width:0}.ggs-brand>span{width:30px;height:30px;display:grid;place-items:center;border:1px solid rgba(104,232,244,.48);border-radius:9px;color:#68e8f4;font-weight:900}.ggs-brand b{display:block;font-size:10px;letter-spacing:.06em;white-space:nowrap}.ggs-brand small{display:block;margin-top:3px;color:#6c929d;font:800 6px ui-monospace,monospace;letter-spacing:.1em;white-space:nowrap}
    .ggs-state{min-width:0;color:#68e8f4;font:800 7px ui-monospace,monospace;letter-spacing:.07em;line-height:1.5}.ggs-state[data-state="error"]{color:#ffb7b7}
    .ggs-actions{display:flex;gap:6px}.ggs-actions button{border:1px solid rgba(104,232,244,.22);border-radius:8px;padding:9px 10px;background:rgba(104,232,244,.05);color:#c9f8fc;font:800 7px ui-monospace,monospace;letter-spacing:.05em;white-space:nowrap;cursor:pointer}.ggs-actions button:hover{border-color:#68e8f4;background:rgba(104,232,244,.12)}
    body.gem-global-surface-window #loading-screen{z-index:19000}
    @media(max-width:780px){.gem-global-surface-toolbar{left:8px;top:8px;right:8px;flex-wrap:wrap;gap:8px}.ggs-brand{flex:1}.ggs-state{order:3;flex-basis:100%}.ggs-actions button{padding:8px}.ggs-brand small{font-size:5px}}
  `;
  document.head.append(style);
  document.body.append(toolbar);

  toolbar.querySelector('[data-global-surface-tools]').addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('gem:open-planet-surface'));
  });
  toolbar.querySelector('[data-global-surface-home]').addEventListener('click', () => {
    window.location.assign(buildGemHomeUrl(window.location.href));
  });

  const state = toolbar.querySelector('[data-global-surface-state]');
  const setState = (message, tone = 'ready') => {
    if (!state.isConnected) return;
    state.textContent = message;
    state.dataset.state = tone;
  };
  document.addEventListener('gem:planet-surface-ready', (event) => {
    const detail = event.detail || {};
    const viewerReady = detail.viewer && !detail.viewer.isDestroyed?.();
    const controller = detail.mapStackController;
    const active = controller?.getActiveStack?.();
    if (viewerReady) {
      setState('3D VIEWER READY' + (active?.label ? ' · ' + String(active.label).toUpperCase() : ''), 'ready');
    } else {
      setState('CONNECTING TO CESIUM SCENE…', 'loading');
    }
  });
  document.addEventListener('gem:planet-surface-error', (event) => {
    const message = String(event.detail?.message || 'Viewer initialization failed').slice(0, 180);
    setState('VIEWER ERROR · ' + message, 'error');
  });
}
