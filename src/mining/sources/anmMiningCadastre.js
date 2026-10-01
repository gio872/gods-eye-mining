import * as Cesium from 'cesium';

const DEFAULT_WMS_URL =
  'https://geo.anm.gov.co/webgis/services/ANM/ServiciosGeograficosANM/MapServer/WMSServer';
const DEFAULT_IDENTIFY_URL =
  'https://geo.anm.gov.co/webgis/rest/services/ANM/ServiciosANM/MapServer/identify';

const ANM_LAYERS = Object.freeze({
  solicitudAreaReservaEspecial: 1,
  solicitudVigente: 2,
  subcontrato: 3,
  tituloVigente: 4,
  areaIndigenaRestringida: 6,
  zonasMinerasEtnicas: 7,
  areasEstrategicasMineras: 9,
  areasInversionEstado: 10,
  areaReservaEspecialDeclarada: 11,
  areaReservaEspecialEnTramite: 12,
  areasSusceptiblesMineria: 13,
  zonaReservadaPotencial: 14,
  bancoArea: 15,
});

const DISPLAY_LAYERS = Object.freeze([
  ANM_LAYERS.solicitudAreaReservaEspecial,
  ANM_LAYERS.solicitudVigente,
  ANM_LAYERS.subcontrato,
  ANM_LAYERS.tituloVigente,
  ANM_LAYERS.areaIndigenaRestringida,
  ANM_LAYERS.zonasMinerasEtnicas,
  ANM_LAYERS.areasEstrategicasMineras,
  ANM_LAYERS.areasInversionEstado,
  ANM_LAYERS.areaReservaEspecialDeclarada,
  ANM_LAYERS.areaReservaEspecialEnTramite,
  ANM_LAYERS.areasSusceptiblesMineria,
  ANM_LAYERS.zonaReservadaPotencial,
  ANM_LAYERS.bancoArea,
]);

const IDENTIFY_LAYERS = DISPLAY_LAYERS.join(',');

const LAYER_LABELS = Object.freeze({
  1: 'Solicitud Área de Reserva Especial',
  2: 'Solicitud Vigente',
  3: 'Subcontrato',
  4: 'Título Vigente',
  6: 'Área Indígena Restringida',
  7: 'Zonas Mineras Étnicas',
  9: 'Áreas Estratégicas Mineras',
  10: 'Áreas de Inversión del Estado',
  11: 'Área de Reserva Especial Declarada',
  12: 'Área de Reserva Especial en Trámite',
  13: 'Áreas Susceptibles de la Minería',
  14: 'Zona Reservada con Potencial',
  15: 'Banco de Área',
});

const PRIVATE_OR_ID_FIELDS = /(^|_)(identificacion|numero_identificacion)($|_)/i;
const DISPLAY_FIELD_LIMIT = 16;

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pointFromClick(viewer, position) {
  const canvas = viewer?.scene?.canvas;
  const width = Number(canvas?.clientWidth);
  const height = Number(canvas?.clientHeight);
  if (!canvas || !(width > 0) || !(height > 0) || !position) return null;
  const cartesian = viewer.camera?.pickEllipsoid?.(
    position,
    viewer.scene?.ellipsoid || Cesium.Ellipsoid.WGS84,
  );
  if (!cartesian) return null;
  const cartographic = viewer.scene.ellipsoid.cartesianToCartographic(cartesian);
  if (!cartographic) return null;
  return {
    lon: Cesium.Math.toDegrees(cartographic.longitude),
    lat: Cesium.Math.toDegrees(cartographic.latitude),
  };
}

function viewExtent(viewer) {
  const rectangle = viewer?.camera?.computeViewRectangle?.(
    viewer.scene?.ellipsoid || Cesium.Ellipsoid.WGS84,
  );
  if (!rectangle) return null;
  return [
    Cesium.Math.toDegrees(rectangle.west),
    Cesium.Math.toDegrees(rectangle.south),
    Cesium.Math.toDegrees(rectangle.east),
    Cesium.Math.toDegrees(rectangle.north),
  ];
}

function identifyUrl(url, viewer, point) {
  const canvas = viewer.scene.canvas;
  const extent = viewExtent(viewer) || [
    point.lon - 0.05,
    point.lat - 0.05,
    point.lon + 0.05,
    point.lat + 0.05,
  ];
  const params = new URLSearchParams({
    f: 'json',
    geometry: `${point.lon},${point.lat}`,
    geometryType: 'esriGeometryPoint',
    sr: '4326',
    layers: `all:${IDENTIFY_LAYERS}`,
    tolerance: '4',
    mapExtent: extent.join(','),
    imageDisplay: `${Math.max(1, Number(canvas.clientWidth) || 1024)},${Math.max(
      1,
      Number(canvas.clientHeight) || 1024,
    )},96`,
    returnGeometry: 'false',
    returnFieldName: 'true',
  });
  const normalizedUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  return normalizedUrl + '?' + params.toString();
}

async function requestJson(url, fetchImpl, signal) {
  const response = await fetchImpl(url, {
    signal,
    redirect: 'error',
    headers: { Accept: 'application/json' },
  });
  if (!response?.ok)
    throw new Error(`ANM mining request failed (${response.status ?? 'error'})`);
  const json = await response.json();
  if (json?.error)
    throw new Error(
      String(json.error.message || json.error.details?.join('; ') || 'ANM service error'),
    );
  return json;
}

function hasTitleOrApplication(results) {
  return results.some((result) =>
    [4, 2, 1, 3].includes(Number(result?.layerId)),
  );
}

function displayFields(attributes) {
  return Object.entries(attributes || {})
    .filter(([key, value]) => value != null && value !== '')
    .filter(([key]) => !PRIVATE_OR_ID_FIELDS.test(key))
    .slice(0, DISPLAY_FIELD_LIMIT);
}

function formatValue(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'number')
    return Number.isInteger(value)
      ? String(value)
      : value.toLocaleString('es-CO', {
          maximumFractionDigits: 4,
        });
  if (typeof value === 'string' && /^\\d{13}$/.test(value)) {
    const millis = Number(value);
    if (Number.isFinite(millis))
      return new Date(millis).toLocaleDateString('es-CO');
  }
  return String(value);
}

function renderInfo(panel, point, results) {
  if (!panel) return;
  const title = document.createElement('div');
  title.textContent = 'ANM · CATASTRO MINERO';
  title.style.cssText =
    'font-size:11px;letter-spacing:.15em;color:#f2c55d;margin-bottom:7px;font-weight:700';

  const coord = document.createElement('div');
  coord.textContent =
    `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)} · WGS84`;
  coord.style.cssText =
    'font-size:11px;color:#b8cdd1;margin-bottom:9px';

  panel.replaceChildren(title, coord);

  if (!results.length) {
    const empty = document.createElement('div');
    empty.textContent =
      'Sin objetos ANM identificados en este punto. Esto no constituye un certificado de Área Libre.';
    empty.style.cssText =
      'padding:9px;border-top:1px solid rgba(242,197,93,.2);color:#eaf4f5;line-height:1.4';
    panel.appendChild(empty);
    panel.hidden = false;
    return;
  }

  const availability = document.createElement('div');
  availability.textContent = hasTitleOrApplication(results)
    ? 'ESTADO CARTOGRÁFICO: EXISTE TÍTULO/SOLICITUD U OTRA FIGURA ANM'
    : 'ESTADO CARTOGRÁFICO: SIN TÍTULO/SOLICITUD IDENTIFICADO';
  availability.style.cssText =
    'padding:7px 9px;margin-bottom:9px;border:1px solid rgba(242,197,93,.18);color:#f4d986;line-height:1.35';
  panel.appendChild(availability);

  const note = document.createElement('div');
  note.textContent =
    'La disponibilidad legal debe verificarse mediante la ANM; “sin identificación” no equivale a Área Libre certificada.';
  note.style.cssText =
    'font-size:10px;color:#93aeb3;line-height:1.35;margin-bottom:10px';
  panel.appendChild(note);

  for (const result of results) {
    const card = document.createElement('section');
    card.style.cssText =
      'margin-bottom:9px;padding:9px;border:1px solid rgba(32,206,216,.18);background:rgba(4,17,23,.55)';

    const heading = document.createElement('div');
    heading.textContent =
      LAYER_LABELS[Number(result.layerId)] || String(result.layerName || 'Capa ANM');
    heading.style.cssText =
      'font-size:10px;letter-spacing:.08em;color:#20ced8;margin-bottom:6px;font-weight:700';
    card.appendChild(heading);

    for (const [key, value] of displayFields(result.attributes)) {
      const row = document.createElement('div');
      row.style.cssText =
        'display:flex;justify-content:space-between;gap:10px;margin:3px 0;line-height:1.3';
      const k = document.createElement('span');
      k.textContent = key;
      k.style.color = 'rgba(241,246,247,.55)';
      const v = document.createElement('strong');
      v.textContent = formatValue(value);
      v.style.color = '#edf7f8';
      row.append(k, v);
      card.appendChild(row);
    }
    panel.appendChild(card);
  }
  panel.hidden = false;
}

/**
 * Official ANM Mining Cadastre overlay.
 *
 * The WMS renders ANM mining-status cartography; click identification uses the
 * public ANM ServiciosANM MapServer so operators can inspect titles,
 * applications, subcontracts, reserve/special areas and other figures.
 */
export function createAnmMiningCadastreLayer({
  wmsUrl = DEFAULT_WMS_URL,
  identifyUrl: identifyEndpoint = DEFAULT_IDENTIFY_URL,
  fetchImpl = (...args) => fetch(...args),
  signal = null,
} = {}) {
  if (typeof fetchImpl !== 'function')
    throw new TypeError('A fetch implementation is required');

  let viewer = null;
  let imageryLayer = null;
  let clickHandler = null;
  let detailPanel = null;
  let enabled = false;
  let destroyed = false;
  let lastError = null;
  let lastUpdate = null;
  let lastFeatureCount = 0;

  const clearImagery = () => {
    if (
      imageryLayer &&
      viewer?.imageryLayers?.contains?.(imageryLayer)
    ) {
      viewer.imageryLayers.remove(imageryLayer, true);
    }
    imageryLayer = null;
  };

  const installImagery = () => {
    clearImagery();
    const provider = new Cesium.WebMapServiceImageryProvider({
      url: wmsUrl,
      layers: DISPLAY_LAYERS.join(','),
      parameters: {
        service: 'WMS',
        version: '1.3.0',
        request: 'GetMap',
        format: 'image/png',
        transparent: 'true',
        styles: '',
        crs: 'EPSG:4326',
      },
    });
    imageryLayer = viewer.imageryLayers.addImageryProvider(provider);
    imageryLayer.alpha = 0.72;
  };

  const ensureDetailPanel = () => {
    if (detailPanel || !viewer?.container) return;
    detailPanel = document.createElement('aside');
    detailPanel.id = 'anm-cadastre-detail';
    detailPanel.hidden = true;
    detailPanel.style.cssText =
      'position:absolute;top:120px;right:24px;width:360px;max-height:52vh;overflow:auto;' +
      'box-sizing:border-box;padding:14px 16px;border:1px solid rgba(242,197,93,.34);' +
      'background:rgba(4,17,23,.94);color:#eef8fa;font-family:monospace;font-size:11px;' +
      'line-height:1.35;z-index:49;box-shadow:0 14px 32px rgba(0,0,0,.42);backdrop-filter:blur(8px);';
    viewer.container.appendChild(detailPanel);
  };

  const identifyAtClick = async (movement) => {
    if (!enabled || destroyed || !viewer || signal?.aborted) return;
    const point = pointFromClick(viewer, movement?.position);
    if (!point) {
      if (detailPanel) detailPanel.hidden = true;
      return;
    }
    try {
      const json = await requestJson(
        identifyUrl(identifyEndpoint, viewer, point),
        fetchImpl,
        signal,
      );
      const results = Array.isArray(json?.results) ? json.results : [];
      lastFeatureCount = results.length;
      lastUpdate = Date.now();
      lastError = null;
      renderInfo(detailPanel, point, results);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (detailPanel) {
        detailPanel.textContent = `ANM: ${lastError}`;
        detailPanel.hidden = false;
      }
    }
  };

  const layer = {
    id: 'anm-mining-cadastre',
    name: 'Catastro Minero ANM',
    icon: '⛏',
    source: 'ANM · Servicios Geográficos Oficiales',
    updateInterval: 0,
    showInTogglePanel: true,

    init(nextViewer) {
      viewer = nextViewer || null;
      if (!viewer) return false;
      ensureDetailPanel();
      clickHandler?.destroy?.();
      clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      clickHandler.setInputAction(
        (movement) => void identifyAtClick(movement),
        Cesium.ScreenSpaceEventType.LEFT_CLICK,
      );
      return true;
    },

    enable(nextViewer) {
      if (destroyed) return false;
      viewer = nextViewer || viewer;
      if (!viewer) return false;
      installImagery();
      enabled = true;
      lastError = null;
      lastUpdate = Date.now();
      return true;
    },

    disable() {
      enabled = false;
      clearImagery();
      if (detailPanel) detailPanel.hidden = true;
      return true;
    },

    async update() {
      return enabled && !destroyed;
    },

    destroy() {
      if (destroyed) return;
      clearImagery();
      clickHandler?.destroy?.();
      clickHandler = null;
      detailPanel?.remove?.();
      detailPanel = null;
      viewer = null;
      destroyed = true;
    },

    getStats() {
      return {
        count: lastFeatureCount,
        lastUpdate,
        error: lastError,
      };
    },

    getParams() {
      return {
        source: 'ANM',
        visibleLayers: [...DISPLAY_LAYERS],
        legalFreeArea: 'not-certified',
      };
    },
  };

  return Object.freeze(layer);
}

export const ANM_MINING_ENDPOINTS = Object.freeze({
  wms: DEFAULT_WMS_URL,
  identify: DEFAULT_IDENTIFY_URL,
  layers: Object.freeze({ ...ANM_LAYERS }),
});
