import { createStandaloneApplication } from './standalone/application.js';
import { describeError } from './standalone/errors.js';
import { installMineralIntelligenceCenter } from './ui/mineralIntelligenceCenter.js';
import { installGemMiningModules } from './ui/gemMiningModules.js';
import { flyToGlobeView } from './locations.js';

function installGemActivationGate() {
  if (document.getElementById('gem-activation-gate')) return;
  const gate = document.createElement('div');
  gate.id = 'gem-activation-gate';
  gate.innerHTML = `
    <div class="gem-gate-grid"></div>
    <div class="gem-gate-orb" aria-hidden="true"><span>GEM</span></div>
    <div class="gem-gate-kicker">TERRAQUEEN · MINERAL INTELLIGENCE SYSTEM</div>
    <h1>GEM</h1>
    <h2>MINERAL INTELLIGENCE CENTER</h2>
    <p>Global exploration · satellite fusion · geology · geophysics · geochemistry · AI targeting · resources</p>
    <button id="gem-activate-button" type="button">
      <span>ACTIVATE GEM</span>
      <small>ENTER MINERAL INTELLIGENCE CENTER</small>
      <b>›</b>
    </button>
    <div class="gem-gate-status"><i></i> GEM CORE STANDBY · AWAITING OPERATOR</div>
  `;
  const style = document.createElement('style');
  style.id = 'gem-activation-gate-styles';
  style.textContent = `
    #gem-activation-gate{position:fixed;inset:0;z-index:2147483646;display:grid;place-content:center;text-align:center;color:#e9fbff;background:radial-gradient(circle at 50% 45%,rgba(12,92,121,.24),transparent 32%),linear-gradient(180deg,#020910 0%,#02070d 100%);font-family:Inter,system-ui,sans-serif;overflow:hidden}
    #gem-activation-gate .gem-gate-grid{position:absolute;inset:0;background:linear-gradient(rgba(59,219,243,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(59,219,243,.06) 1px,transparent 1px);background-size:46px 46px;mask-image:radial-gradient(circle at center,#000 0 55%,transparent 86%);pointer-events:none}
    #gem-activation-gate .gem-gate-orb{width:92px;height:92px;margin:0 auto 18px;border:1px solid #f0c45b;border-radius:50%;display:grid;place-items:center;box-shadow:0 0 30px rgba(58,225,247,.25),inset 0 0 30px rgba(242,194,88,.1);background:radial-gradient(circle,#123a4b 0,#06151f 56%,#020910 100%)}
    #gem-activation-gate .gem-gate-orb span{color:#39e3f6;font:900 22px JetBrains Mono,monospace;letter-spacing:.08em}
    #gem-activation-gate .gem-gate-kicker{color:#38dff3;font:800 9px JetBrains Mono,monospace;letter-spacing:.2em}
    #gem-activation-gate h1{margin:10px 0 0;color:#f2c55a;font:900 56px/1 Inter,sans-serif;letter-spacing:.12em;text-shadow:0 0 30px rgba(240,197,90,.18)}
    #gem-activation-gate h2{margin:8px 0 0;color:#f2fbfd;font:800 18px JetBrains Mono,monospace;letter-spacing:.12em}
    #gem-activation-gate p{max-width:650px;margin:13px auto 22px;color:#789ba4;font:600 9px/1.7 JetBrains Mono,monospace;letter-spacing:.04em}
    #gem-activate-button{position:relative;width:min(480px,82vw);height:74px;margin:0 auto;border:1px solid #f3c95a;border-radius:10px;background:linear-gradient(180deg,rgba(242,193,76,.2),rgba(242,193,76,.06));color:#f8d66f;cursor:pointer;box-shadow:0 0 34px rgba(242,193,76,.12),inset 0 0 22px rgba(242,193,76,.06);transition:.2s}
    #gem-activate-button:hover{transform:translateY(-1px);box-shadow:0 0 42px rgba(58,225,247,.2),0 0 34px rgba(242,193,76,.18),inset 0 0 22px rgba(242,193,76,.08)}
    #gem-activate-button span{display:block;font:900 17px Inter,sans-serif;letter-spacing:.14em}
    #gem-activate-button small{display:block;margin-top:5px;color:#d9c583;font:700 8px JetBrains Mono,monospace;letter-spacing:.14em}
    #gem-activate-button b{position:absolute;right:22px;top:13px;font:300 35px Inter,sans-serif}
    #gem-activation-gate .gem-gate-status{margin-top:17px;color:#557982;font:700 7px JetBrains Mono,monospace;letter-spacing:.08em}
    #gem-activation-gate .gem-gate-status i{display:inline-block;width:7px;height:7px;margin-right:5px;border-radius:50%;background:#f0c45b;box-shadow:0 0 8px rgba(240,196,91,.6)}
  `;
  document.head.appendChild(style);
  document.body.appendChild(gate);
  const activate = () => {
    gate.querySelector('.gem-gate-status').innerHTML = '<i style="background:#20e2a6;box-shadow:0 0 8px #20e2a6"></i> GEM CORE INITIALIZING…';
    document.documentElement.dataset.gemActivation = 'active';
    document.querySelector('#first-run-launcher')?.remove();
    gate.remove();
    if (window.__gemActivate) window.__gemActivate();
    else window.__gemActivatePending = true;
  };
  gate.querySelector('#gem-activate-button').addEventListener('click', activate);
}

installGemActivationGate();

const application = createStandaloneApplication({
  googleApiKey: import.meta.env.GOOGLE_MAPS_API_KEY,
  cesiumToken: import.meta.env.CESIUM_ION_TOKEN,
  allowQaRegistration: import.meta.env.DEV,
});

application.start().then((components) => {
  const dataManager = components?.data?.dataManager;
  const viewer = components?.scene?.viewer;
  window.__gemViewer = viewer;
  window.__gemActivate = () => {
    installMineralIntelligenceCenter({ dataManager });
    if (dataManager) installGemMiningModules(dataManager);
    if (viewer) {
      try { flyToGlobeView(viewer, { duration: 2.4 }); } catch (error) { console.warn('[GEM] Global startup view:', error); }
    }
  };
  if (window.__gemActivatePending) {
    delete window.__gemActivatePending;
    window.__gemActivate();
  }
}).catch((error) => {
  console.error('GEM Mineral Intelligence initialization failed:', error);
  const message = describeError(error);
  const gate = document.getElementById('gem-activation-gate');
  if (gate) {
    const status = gate.querySelector('.gem-gate-status');
    if (status) status.textContent = 'GEM CORE START ERROR · ' + message;
  }
});

export { application };
