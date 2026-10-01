import * as Cesium from 'cesium';

const DEFAULT_ENDPOINT = 'https://api.metals.dev/v1/latest';
const DEFAULT_CURRENCY_ENDPOINT = 'https://api.metals.dev/v1/currencies';
const REFRESH_INTERVAL_MS = 60_000;

const METALS = Object.freeze([
  { id: 'gold', symbol: 'Au', name: 'Oro', group: 'precious', unit: 'toz' },
  { id: 'silver', symbol: 'Ag', name: 'Plata', group: 'precious', unit: 'toz' },
  { id: 'platinum', symbol: 'Pt', name: 'Platino', group: 'precious', unit: 'toz' },
  { id: 'palladium', symbol: 'Pd', name: 'Paladio', group: 'precious', unit: 'toz' },
  { id: 'copper', symbol: 'Cu', name: 'Cobre', group: 'base', unit: 'mt' },
  { id: 'aluminum', symbol: 'Al', name: 'Aluminio', group: 'base', unit: 'mt' },
  { id: 'nickel', symbol: 'Ni', name: 'Níquel', group: 'base', unit: 'mt' },
  { id: 'lead', symbol: 'Pb', name: 'Plomo', group: 'base', unit: 'mt' },
  { id: 'zinc', symbol: 'Zn', name: 'Zinc', group: 'base', unit: 'mt' },
]);

const GROUPS = Object.freeze({
  all: { label: 'Todos', ids: METALS.map((metal) => metal.id) },
  precious: {
    label: 'Preciosos',
    ids: METALS.filter((metal) => metal.group === 'precious').map((metal) => metal.id),
  },
  base: {
    label: 'Base',
    ids: METALS.filter((metal) => metal.group === 'base').map((metal) => metal.id),
  },
});

const GROUP_LABELS = Object.freeze({
  all: 'Todos',
  precious: 'Metales preciosos',
  base: 'Metales industriales',
});

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatPrice(value, digits = 2) {
  const number = finite(value);
  if (number === null) return '—';
  return number.toLocaleString('es-CO', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatSigned(value, digits = 2) {
  const number = finite(value);
  if (number === null) return '—';
  const prefix = number > 0 ? '+' : '';
  return prefix + formatPrice(number, digits);
}

function groupForMetal(metal) {
  return metal?.group === 'precious' ? 'PRECIOUS' : 'BASE';
}

function marketStatus(timestamp, now = Date.now()) {
  const time = Date.parse(timestamp || '');
  if (!Number.isFinite(time)) return 'LIVE';
  const age = Math.max(0, now - time);
  if (age <= 75_000) return 'LIVE';
  if (age <= 10 * 60_000) return 'DELAYED';
  return 'STALE';
}

function statusClass(status) {
  return status.toLowerCase();
}

async function fetchJson(url, fetchImpl, signal) {
  const response = await fetchImpl(url, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response?.ok)
    throw new Error(`Metal market request failed (HTTP ${response.status ?? 'error'})`);
  const json = await response.json();
  if (json?.status === 'failure' || json?.error)
    throw new Error(
      String(json?.error?.message || json?.error?.info || 'Metal market provider error'),
    );
  return json;
}

function marketUrl(endpoint, apiKey, currency = 'USD') {
  const params = new URLSearchParams({
    api_key: apiKey,
    currency,
  });
  return `${endpoint}?${params}`;
}

function metalRows(json) {
  const rates = json?.metals && typeof json.metals === 'object' ? json.metals : {};
  return METALS.map((metal) => {
    const value = finite(rates[metal.id]);
    return {
      ...metal,
      price: value,
      previous: null,
      change: null,
    };
  });
}

function createPanel(viewer, apiKey) {
  const panel = document.createElement('section');
  panel.id = 'terraqueen-metal-markets';
  panel.innerHTML = `
    <header class="tqm-header">
      <div>
        <div class="tqm-kicker">TERRAQUEEN · MARKET INTELLIGENCE</div>
        <div class="tqm-title">MERCADO DE METALES</div>
        <div class="tqm-subtitle">SPOT · BENCHMARK · INDUSTRIAL · USD / COP</div>
      </div>
      <button type="button" class="tqm-close" title="Cerrar mercado">×</button>
    </header>
    <div class="tqm-toolbar" role="tablist" aria-label="Grupo de metales"></div>
    <div class="tqm-content"></div>
    <footer class="tqm-footer"></footer>
  `;
  const styles = document.createElement('style');
  styles.textContent = `
    #terraqueen-metal-markets {
      position:absolute;
      top:92px;
      right:calc(var(--right-rail-x, 52px) + 350px);
      width:min(540px, calc(100vw - 430px));
      max-height:calc(100vh - 150px);
      overflow:hidden;
      display:flex;
      flex-direction:column;
      box-sizing:border-box;
      padding:15px 16px 10px;
      color:#eef8fa;
      background:linear-gradient(150deg,rgba(4,17,23,.97),rgba(7,24,30,.95));
      border:1px solid rgba(242,197,93,.34);
      border-radius:11px;
      box-shadow:0 18px 50px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.04);
      backdrop-filter:blur(11px);
      z-index:159;
      font-family:monospace;
    }
    #terraqueen-metal-markets .tqm-header {
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:14px;
      padding-bottom:11px;
      border-bottom:1px solid rgba(242,197,93,.13);
    }
    #terraqueen-metal-markets .tqm-kicker {
      font-size:8px;
      letter-spacing:.16em;
      color:#f2c55d;
      font-weight:700;
    }
    #terraqueen-metal-markets .tqm-title {
      margin-top:3px;
      font-family:system-ui,sans-serif;
      font-size:19px;
      letter-spacing:.08em;
      font-weight:700;
    }
    #terraqueen-metal-markets .tqm-subtitle {
      margin-top:3px;
      font-size:8px;
      letter-spacing:.11em;
      color:#67dfe6;
    }
    #terraqueen-metal-markets .tqm-close {
      width:28px;height:28px;border-radius:6px;
      border:1px solid rgba(242,197,93,.28);
      background:rgba(242,197,93,.06);
      color:#f2c55d;font-size:19px;cursor:pointer;
    }
    #terraqueen-metal-markets .tqm-toolbar {
      display:flex;gap:6px;flex-wrap:wrap;
      padding:10px 0 9px;
    }
    #terraqueen-metal-markets .tqm-tab {
      border:1px solid rgba(32,206,216,.23);
      background:rgba(32,206,216,.05);
      color:#a9c9ce;border-radius:6px;padding:6px 10px;
      font:700 9px monospace;letter-spacing:.08em;cursor:pointer;
    }
    #terraqueen-metal-markets .tqm-tab.active {
      border-color:#f2c55d;
      color:#f5d783;background:rgba(242,197,93,.1);
      box-shadow:0 0 12px rgba(242,197,93,.1);
    }
    #terraqueen-metal-markets .tqm-scroll {
      min-height:0;overflow:auto;
      scrollbar-width:thin;
      scrollbar-color:rgba(32,206,216,.45) transparent;
    }
    #terraqueen-metal-markets .tqm-table {
      width:100%;border-collapse:collapse;font-size:10px;
    }
    #terraqueen-metal-markets .tqm-table th {
      text-align:left;padding:6px 5px;color:#6ea9b0;
      font-size:8px;letter-spacing:.09em;border-bottom:1px solid rgba(255,255,255,.08);
      position:sticky;top:0;background:rgba(5,18,24,.96);
    }
    #terraqueen-metal-markets .tqm-table td {
      padding:9px 5px;border-bottom:1px solid rgba(255,255,255,.055);
      vertical-align:middle;
    }
    #terraqueen-metal-markets .tqm-table tr:hover td { background:rgba(32,206,216,.045); }
    #terraqueen-metal-markets .tqm-symbol {
      display:inline-flex;min-width:27px;justify-content:center;
      color:#f2c55d;font-weight:700;
    }
    #terraqueen-metal-markets .tqm-metal-name { color:#eef8fa;font-weight:700; }
    #terraqueen-metal-markets .tqm-price { text-align:right;color:#fff; }
    #terraqueen-metal-markets .tqm-cop { text-align:right;color:#91e7eb; }
    #terraqueen-metal-markets .tqm-change { text-align:right;font-weight:700; }
    #terraqueen-metal-markets .tqm-unit { color:#748e93;font-size:8px; }
    #terraqueen-metal-markets .tqm-status {
      display:inline-block;font-size:7px;letter-spacing:.08em;padding:3px 5px;border-radius:4px;
      border:1px solid rgba(255,255,255,.09);color:#83b8be;
    }
    #terraqueen-metal-markets .tqm-status.live { color:#70f0c5;border-color:rgba(112,240,197,.25); }
    #terraqueen-metal-markets .tqm-status.delayed { color:#f2c55d;border-color:rgba(242,197,93,.24); }
    #terraqueen-metal-markets .tqm-status.stale { color:#ff9c8f;border-color:rgba(255,156,143,.24); }
    #terraqueen-metal-markets .tqm-change.up { color:#70f0c5; }
    #terraqueen-metal-markets .tqm-change.down { color:#ff9c8f; }
    #terraqueen-metal-markets .tqm-footer {
      padding-top:8px;margin-top:4px;border-top:1px solid rgba(242,197,93,.12);
      color:#658389;font-size:8px;line-height:1.4;
    }
    #terraqueen-metal-markets .tqm-key {
      padding:12px;border:1px solid rgba(242,197,93,.2);border-radius:7px;
      color:#d7e9ec;font-size:10px;line-height:1.5;
    }
    #terraqueen-metal-markets .tqm-key strong { color:#f2c55d; }
    @media (max-width:900px) {
      #terraqueen-metal-markets {
        right:16px;left:16px;top:105px;width:auto;max-width:none;
      }
    }
  `;
  viewer.container.appendChild(styles);
  viewer.container.appendChild(panel);
  return panel;
}

function renderMarket(panel, state) {
  const content = panel.querySelector('.tqm-content');
  const footer = panel.querySelector('.tqm-footer');
  const toolbar = panel.querySelector('.tqm-toolbar');
  toolbar.replaceChildren();

  Object.entries(GROUPS).forEach(([group, config]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `tqm-tab${state.group === group ? ' active' : ''}`;
    button.textContent = config.label;
    button.addEventListener('click', () => {
      state.group = group;
      renderMarket(panel, state);
    });
    toolbar.appendChild(button);
  });

  content.replaceChildren();

  if (!state.apiKey) {
    const key = document.createElement('div');
    key.className = 'tqm-key';
    key.innerHTML =
      '<strong>DATOS DE MERCADO NO CONFIGURADOS</strong><br>' +
      'Añade la variable <strong>VITE_METALS_DEV_API_KEY</strong> al entorno de TERRAQUEEN.<br>' +
      'Metals.Dev ofrece una cuenta gratuita con 100 solicitudes/mes y actualizaciones de hasta 60 s.';
    content.appendChild(key);
    footer.textContent = 'Proveedor preparado: Metals.Dev · CORS habilitado · estado: CONFIGURACIÓN REQUERIDA';
    return;
  }

  if (state.loading && !state.rows.length) {
    content.innerHTML =
      '<div class="tqm-key"><strong>ACTUALIZANDO MERCADO...</strong><br>Consultando cotizaciones.</div>';
    return;
  }

  if (state.error && !state.rows.length) {
    content.innerHTML =
      `<div class="tqm-key"><strong>ERROR DE MERCADO</strong><br>${String(state.error)}</div>`;
    footer.textContent = 'Comprueba la API key y la conectividad del proveedor.';
    return;
  }

  const metals = state.rows.filter((metal) =>
    GROUPS[state.group].ids.includes(metal.id),
  );
  const table = document.createElement('table');
  table.className = 'tqm-table';
  table.innerHTML =
    '<thead><tr><th>METAL</th><th>PRECIO USD</th><th>VALOR COP</th><th>Δ ÚLTIMO TICK</th><th>ESTADO</th></tr></thead>';
  const body = document.createElement('tbody');

  metals.forEach((metal) => {
    const row = document.createElement('tr');
    const cop = metal.price !== null && state.usdCop !== null
      ? metal.price * state.usdCop
      : null;
    const change = metal.change;
    const changeClass = change > 0 ? 'up' : change < 0 ? 'down' : '';
    const usdDigits = metal.unit === 'mt' ? 0 : 2;
    const copDigits = metal.unit === 'mt' ? 0 : 0;
    row.innerHTML =
      `<td><span class="tqm-symbol">${metal.symbol}</span> <span class="tqm-metal-name">${metal.name}</span><div class="tqm-unit">/${metal.unit}</div></td>` +
      `<td class="tqm-price">${formatPrice(metal.price, usdDigits)}</td>` +
      `<td class="tqm-cop">${cop === null ? '—' : '$ ' + formatPrice(cop, copDigits)}</td>` +
      `<td class="tqm-change ${changeClass}">${formatSigned(change, usdDigits)}</td>` +
      `<td><span class="tqm-status ${statusClass(state.status)}">${state.status}</span></td>`;
    body.appendChild(row);
  });
  table.appendChild(body);
  const scroll = document.createElement('div');
  scroll.className = 'tqm-scroll';
  scroll.appendChild(table);
  content.appendChild(scroll);

  const age = state.timestamp ? Math.max(0, Math.round((Date.now() - Date.parse(state.timestamp)) / 1000)) : null;
  footer.textContent =
    `Fuente: Metals.Dev · ${state.timestamp ? new Date(state.timestamp).toLocaleString('es-CO') : 'sin marca de tiempo'} · USD/COP ${state.usdCop === null ? '—' : formatPrice(state.usdCop, 2)} · ${age === null ? 'sin antigüedad' : age + ' s'}${state.error ? ' · actualización con error; mostrando último dato válido' : ''}`;
}

export function createMetalMarketsLayer({
  endpoint = DEFAULT_ENDPOINT,
  fetchImpl = (...args) => fetch(...args),
  apiKey = import.meta.env?.VITE_METALS_DEV_API_KEY || '',
  refreshInterval = REFRESH_INTERVAL_MS,
  signal = null,
} = {}) {
  if (typeof fetchImpl !== 'function')
    throw new TypeError('A fetch implementation is required');

  let viewer = null;
  let panel = null;
  let timer = null;
  let clickHandler = null;
  let enabled = false;
  let destroyed = false;
  let rowControlsListener = null;
  let group = 'all';
  let lastUpdate = null;
  let lastError = null;
  let rows = [];
  let usdCop = null;
  let providerTimestamp = null;
  let loading = false;
  let previousPrices = new Map();

  const state = () => ({
    apiKey: String(apiKey || '').trim(),
    group,
    rows,
    usdCop,
    timestamp: providerTimestamp,
    error: lastError,
    loading,
    status: marketStatus(providerTimestamp),
  });

  const render = () => {
    if (panel) renderMarket(panel, state());
    rowControlsListener?.();
  };

  const refresh = async () => {
    if (!enabled || destroyed || signal?.aborted || !String(apiKey || '').trim()) {
      render();
      return false;
    }
    if (loading) return false;
    loading = true;
    lastError = null;
    render();
    try {
      const json = await fetchJson(
        marketUrl(endpoint, String(apiKey).trim(), 'USD'),
        fetchImpl,
        signal,
      );
      const nextRows = metalRows(json).map((metal) => ({
        ...metal,
        change: previousPrices.has(metal.id) && metal.price !== null
          ? metal.price - previousPrices.get(metal.id)
          : null,
      }));
      const usdPerCop = finite(json?.currencies?.COP);
      previousPrices = new Map(
        nextRows
          .filter((metal) => metal.price !== null)
          .map((metal) => [metal.id, metal.price]),
      );
      rows = nextRows;
      usdCop = usdPerCop;
      providerTimestamp = json?.timestamp || null;
      lastUpdate = Date.now();
      lastError = null;
      return true;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      return false;
    } finally {
      loading = false;
      render();
    }
  };

  const stopTimer = () => {
    if (timer !== null) clearInterval(timer);
    timer = null;
  };

  const startTimer = () => {
    stopTimer();
    if (refreshInterval > 0)
      timer = setInterval(() => void refresh(), refreshInterval);
  };

  const layer = {
    id: 'metal-markets',
    name: 'Mercado de Metales',
    icon: '◆',
    source: 'Metals.Dev · Spot / LBMA / LME',
    updateInterval: 0,
    showInTogglePanel: true,

    setRowControlsListener(listener) {
      rowControlsListener = typeof listener === 'function' ? listener : null;
    },

    getRowControls() {
      return {
        chips: Object.entries(GROUPS).map(([id, config]) => ({
          id,
          label: config.label,
          active: id === group,
          onClick: () => {
            group = id;
            render();
          },
        })),
        info: providerTimestamp
          ? `Proveedor: Metals.Dev · ${marketStatus(providerTimestamp)} · ${new Date(providerTimestamp).toLocaleTimeString('es-CO')}`
          : 'Proveedor: Metals.Dev · configuración pendiente',
        infoTitle: 'El módulo muestra precio spot, variación desde el último refresco y conversión aproximada a COP con el tipo USD/COP del mismo proveedor.',
      };
    },

    init(nextViewer) {
      viewer = nextViewer || null;
      if (!viewer) return false;
      if (!panel) panel = createPanel(viewer, apiKey);
      const close = panel.querySelector('.tqm-close');
      close?.addEventListener('click', () => {
        panel.hidden = true;
      });
      clickHandler?.destroy?.();
      clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      return true;
    },

    enable(nextViewer) {
      if (destroyed) return false;
      viewer = nextViewer || viewer;
      if (!viewer) return false;
      enabled = true;
      if (panel) panel.hidden = false;
      void refresh();
      startTimer();
      return true;
    },

    disable() {
      enabled = false;
      stopTimer();
      if (panel) panel.hidden = true;
      return true;
    },

    async update() {
      if (!enabled) return true;
      await refresh();
      return true;
    },

    destroy() {
      if (destroyed) return;
      stopTimer();
      clickHandler?.destroy?.();
      clickHandler = null;
      panel?.remove?.();
      panel = null;
      viewer = null;
      destroyed = true;
    },

    getStats() {
      return {
        count: rows.length,
        lastUpdate,
        source: 'Metals.Dev',
        error: lastError,
        loading,
        status: providerTimestamp ? marketStatus(providerTimestamp) : 'configuration-required',
      };
    },

    getParams() {
      return {
        provider: 'metals.dev',
        group,
        refreshInterval,
        currency: 'USD',
        cop: usdCop,
      };
    },
  };

  return Object.freeze(layer);
}

export const METAL_MARKETS_ENDPOINTS = Object.freeze({
  latest: DEFAULT_ENDPOINT,
  currencies: DEFAULT_CURRENCY_ENDPOINT,
});

export const METAL_MARKETS_SYMBOLS = METALS;
