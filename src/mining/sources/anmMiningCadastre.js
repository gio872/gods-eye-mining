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

const ANM_CATEGORY_LAYERS = Object.freeze({
  all: DISPLAY_LAYERS,
  titles: Object.freeze([ANM_LAYERS.tituloVigente]),
  applications: Object.freeze([
    ANM_LAYERS.solicitudAreaReservaEspecial,
    ANM_LAYERS.solicitudVigente,
  ]),
  subcontracts: Object.freeze([ANM_LAYERS.subcontrato]),
  special: Object.freeze([
    ANM_LAYERS.areaIndigenaRestringida,
    ANM_LAYERS.zonasMinerasEtnicas,
    ANM_LAYERS.areasEstrategicasMineras,
    ANM_LAYERS.areasInversionEstado,
    ANM_LAYERS.areaReservaEspecialDeclarada,
    ANM_LAYERS.areaReservaEspecialEnTramite,
  ]),
  availability: Object.freeze([
    ANM_LAYERS.areasSusceptiblesMineria,
    ANM_LAYERS.zonaReservadaPotencial,
    ANM_LAYERS.bancoArea,
  ]),
});

const ANM_CATEGORY_LABELS = Object.freeze({
  all: 'Todo',
  titles: 'Títulos',
  applications: 'Solicitudes',
  subcontracts: 'Subcontratos',
  special: 'Áreas especiales',
  availability: 'Disponibilidad',
});

const PRIVATE_OR_ID_FIELDS =
  /(^|_)(identificacion|numero_identificacion)($|_)/i;
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
  const cartographic =
    viewer.scene.ellipsoid.cartesianToCartographic(cartesian);
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
    returnGeometry: 'true',
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
    throw new Error(
      `ANM mining request failed (${response.status ?? 'error'})`,
    );
  const json = await response.json();
  if (json?.error)
    throw new Error(
      String(
        json.error.message ||
          json.error.details?.join('; ') ||
          'ANM service error',
      ),
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
  if (
    typeof value === 'string' &&
    value.length === 13 &&
    [...value].every((ch) => ch >= '0' && ch <= '9')
  ) {
    const millis = Number(value);
    if (Number.isFinite(millis))
      return new Date(millis).toLocaleDateString('es-CO');
  }
  return String(value);
}

function layerColor(layerId) {
  return (
    {
      1: '#f2c55d',
      2: '#ffd95e',
      3: '#ff9f43',
      4: '#f6c85f',
      6: '#d18cff',
      7: '#c08cff',
      9: '#ff6b5f',
      10: '#ff8f55',
      11: '#7fe3d4',
      12: '#5fd6ff',
      13: '#8bd450',
      14: '#7ca7ff',
      15: '#9fc4ff',
    }[Number(layerId)] || '#20ced8'
  );
}

function geometryPoints(geometry) {
  if (!geometry || typeof geometry !== 'object') return [];
  if (Array.isArray(geometry.rings))
    return geometry.rings.filter(
      (ring) => Array.isArray(ring) && ring.length >= 2,
    );
  if (Array.isArray(geometry.paths))
    return geometry.paths.filter(
      (path) => Array.isArray(path) && path.length >= 2,
    );
  return [];
}

function geometryCenter(geometry) {
  if (finite(geometry?.x) !== null && finite(geometry?.y) !== null)
    return { lon: Number(geometry.x), lat: Number(geometry.y) };
  const groups = geometryPoints(geometry);
  const points = groups
    .flat()
    .filter(
      (pair) =>
        Array.isArray(pair) &&
        finite(pair[0]) !== null &&
        finite(pair[1]) !== null,
    );
  if (!points.length) return null;
  const total = points.reduce(
    (sum, pair) => ({
      lon: sum.lon + Number(pair[0]),
      lat: sum.lat + Number(pair[1]),
    }),
    { lon: 0, lat: 0 },
  );
  return {
    lon: total.lon / points.length,
    lat: total.lat / points.length,
  };
}

function clearHighlights(dataSource, overlay) {
  dataSource?.entities?.removeAll?.();
  overlay?.clearSource?.('anm-mining-cadastre');
}

function highlightResults(dataSource, results, clickPoint, overlay) {
  if (!dataSource) return;
  clearHighlights(dataSource, overlay);
  const pointEntity = dataSource.entities.add({
    position: Cesium.Cartesian3.fromDegrees(clickPoint.lon, clickPoint.lat, 0),
    point: {
      pixelSize: 13,
      color: Cesium.Color.WHITE.withAlpha(0.98),
      outlineColor: Cesium.Color.fromCssColorString('#20ced8'),
      outlineWidth: 3,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });
  pointEntity.show = true;

  const overlayEntries = [
    {
      id: 'anm-clicked-point',
      position: Cesium.Cartesian3.fromDegrees(
        clickPoint.lon,
        clickPoint.lat,
        0,
      ),
      variant: 'label',
      title: 'OBJETO SEÑALADO',
      priority: 1000,
      protected: true,
      collisionGroup: 'anm-mining',
    },
  ];

  results.forEach((result, resultIndex) => {
    const colorHex = layerColor(result.layerId);
    const color = Cesium.Color.fromCssColorString(colorHex);
    const geometry = result?.geometry;
    const groups = geometryPoints(geometry);
    const labelValue =
      result?.attributes?.CODIGO_EXPEDIENTE ||
      result?.attributes?.NOMBRE_DE_TITULAR ||
      result?.attributes?.NOMBRE_SOLICITANTE ||
      `OBJETO ANM ${resultIndex + 1}`;
    const labelCenter = geometryCenter(geometry) || clickPoint;

    groups.forEach((group, groupIndex) => {
      const cleaned = group.filter(
        (pair) =>
          Array.isArray(pair) &&
          finite(pair[0]) !== null &&
          finite(pair[1]) !== null,
      );
      if (cleaned.length < 2) return;
      const positions = cleaned.map(([lon, lat]) =>
        Cesium.Cartesian3.fromDegrees(Number(lon), Number(lat), 0),
      );
      if (
        Number(result?.geometry?.rings ? 1 : 0) &&
        positions.length > 2 &&
        !Cesium.Cartesian3.equals(positions[0], positions[positions.length - 1])
      )
        positions.push(positions[0]);

      dataSource.entities.add({
        polyline: {
          positions,
          width: 9,
          clampToGround: true,
          material: color.withAlpha(0.28),
          depthFailMaterial: color.withAlpha(0.28),
        },
      });
      dataSource.entities.add({
        polyline: {
          positions,
          width: 3,
          clampToGround: true,
          material: color.withAlpha(0.98),
          depthFailMaterial: color.withAlpha(0.98),
        },
      });

      if (groupIndex === 0) {
        overlayEntries.push({
          id: `anm-result-${resultIndex}`,
          position: Cesium.Cartesian3.fromDegrees(
            labelCenter.lon,
            labelCenter.lat,
            0,
          ),
          variant: 'label',
          title: String(labelValue),
          priority: 500 - resultIndex,
          accent: colorHex,
          collisionGroup: 'anm-mining',
        });
      }
    });
  });

  overlayHost?.setEntries?.('anm-mining-cadastre', overlayEntries, {
    visible: true,
    maxVisible: 24,
    collisionCapacity: 32,
  });
}

function renderLegend(panel) {
  const legend = document.createElement('div');
  legend.style.cssText =
    'display:grid;grid-template-columns:1fr 1fr;gap:5px 10px;padding:9px;margin-bottom:10px;' +
    'border:1px solid rgba(32,206,216,.16);background:rgba(4,17,23,.55);font-size:9px;';
  [
    [4, 'Títulos vigentes'],
    [2, 'Solicitudes vigentes'],
    [3, 'Subcontratos'],
    [11, 'Reserva especial declarada'],
    [12, 'Reserva especial en trámite'],
    [9, 'Áreas estratégicas'],
  ].forEach(([id, label]) => {
    const item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:6px;min-width:0';
    const swatch = document.createElement('span');
    swatch.style.cssText = `width:9px;height:9px;display:inline-block;flex:0 0 9px;border:1px solid rgba(255,255,255,.28);background:${layerColor(id)};box-shadow:0 0 8px ${layerColor(id)}55`;
    const text = document.createElement('span');
    text.textContent = label;
    text.style.color = 'rgba(241,246,247,.75)';
    item.append(swatch, text);
    legend.appendChild(item);
  });
  panel.appendChild(legend);
}

function renderInfo(panel, point, results) {
  if (!panel) return;
  const header = document.createElement('div');
  header.style.cssText =
    'display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:7px;';
  const titleWrap = document.createElement('div');
  const title = document.createElement('div');
  title.textContent = 'CENTRO MINERO COLOMBIA · ANM';
  title.style.cssText =
    'font-size:12px;letter-spacing:.13em;color:#f2c55d;font-weight:700';
  const subtitle = document.createElement('div');
  subtitle.textContent = 'INFORMACIÓN CARTOGRÁFICA OFICIAL';
  subtitle.style.cssText =
    'font-size:8px;letter-spacing:.1em;color:#6fe3e8;margin-top:3px;';
  titleWrap.append(title, subtitle);
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.title = 'Cerrar ficha';
  close.style.cssText =
    'width:26px;height:26px;border:1px solid rgba(242,197,93,.24);background:rgba(242,197,93,.06);' +
    'color:#f2c55d;border-radius:6px;cursor:pointer;font-size:18px;line-height:1;';
  close.addEventListener('click', () => {
    panel.hidden = true;
  });
  header.append(titleWrap, close);

  const coord = document.createElement('div');
  coord.textContent = `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)} · WGS84 · OBJETOS SEÑALADOS: ${point?.resultCount ?? 0}`;
  coord.style.cssText = 'font-size:10px;color:#b8cdd1;margin-bottom:9px';

  panel.replaceChildren(header, coord);
  const scope = document.createElement('div');
  scope.textContent =
    'TÍTULOS · SOLICITUDES · ZONAS MINERAS · ÁREAS ESPECIALES';
  scope.style.cssText =
    'font-size:9px;letter-spacing:.07em;color:#20ced8;margin-bottom:9px;';
  panel.appendChild(scope);
  renderLegend(panel);

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
      LAYER_LABELS[Number(result.layerId)] ||
      String(result.layerName || 'Capa ANM');
    heading.style.cssText = `font-size:10px;letter-spacing:.08em;color:${layerColor(result.layerId)};margin-bottom:6px;font-weight:700`;
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
  overlayHost = null,
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
  let highlightDataSource = null;
  let activeCategory = 'all';
  let rowControlsListener = null;

  const clearImagery = () => {
    if (imageryLayer && viewer?.imageryLayers?.contains?.(imageryLayer)) {
      viewer.imageryLayers.remove(imageryLayer, true);
    }
    imageryLayer = null;
  };

  const installImagery = () => {
    clearImagery();
    const selectedLayers =
      ANM_CATEGORY_LAYERS[activeCategory] || DISPLAY_LAYERS;
    const provider = new Cesium.WebMapServiceImageryProvider({
      url: wmsUrl,
      layers: selectedLayers.join(','),
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
      'position:absolute;top:92px;right:calc(var(--right-rail-x, 52px) + 350px);' +
      'width:min(390px, calc(100vw - 430px));max-height:calc(100vh - 128px);overflow:auto;' +
      'box-sizing:border-box;padding:14px 16px;border:1px solid rgba(242,197,93,.38);' +
      'background:rgba(4,17,23,.96);color:#eef8fa;font-family:monospace;font-size:11px;' +
      'line-height:1.35;z-index:160;box-shadow:0 16px 40px rgba(0,0,0,.52);backdrop-filter:blur(10px);';
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
      highlightResults(highlightDataSource, results, point, overlayHost);
      renderInfo(
        detailPanel,
        { ...point, resultCount: results.length },
        results,
      );
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (detailPanel) {
        detailPanel.textContent = `ANM: ${lastError}`;
        detailPanel.hidden = false;
      }
    }
  };

  const notifyRowControls = () => {
    try {
      rowControlsListener?.();
    } catch (error) {
      console.warn('[ANM] row controls listener error:', error);
    }
  };

  const setCategory = (category) => {
    if (!Object.hasOwn(ANM_CATEGORY_LAYERS, category)) return;
    activeCategory = category;
    if (enabled && viewer) installImagery();
    notifyRowControls();
  };

  const getRowControls = () => ({
    chips: Object.keys(ANM_CATEGORY_LAYERS).map((id) => ({
      id,
      label: ANM_CATEGORY_LABELS[id],
      active: id === activeCategory,
      onClick: () => setCategory(id),
    })),
    legend: [
      { label: 'Título vigente', color: layerColor(ANM_LAYERS.tituloVigente) },
      { label: 'Solicitud', color: layerColor(ANM_LAYERS.solicitudVigente) },
      { label: 'Subcontrato', color: layerColor(ANM_LAYERS.subcontrato) },
      {
        label: 'Área especial',
        color: layerColor(ANM_LAYERS.areasEstrategicasMineras),
      },
      {
        label: 'Disponibilidad cartográfica',
        color: layerColor(ANM_LAYERS.areasSusceptiblesMineria),
      },
    ],
    info:
      activeCategory === 'all'
        ? 'Mostrando todas las figuras ANM disponibles en el servicio.'
        : `Filtro activo: ${ANM_CATEGORY_LABELS[activeCategory]}.`,
    infoTitle:
      'El filtro controla la cartografía ANM dibujada. La identificación por clic consulta las figuras visibles.',
  });

  const layer = {
    id: 'anm-mining-cadastre',
    name: 'Centro Minero Colombia · ANM',
    icon: '⛏',
    source: 'ANM · Títulos · Solicitudes · Zonas Mineras Oficiales',
    updateInterval: 0,
    showInTogglePanel: true,

    setRowControlsListener(listener) {
      rowControlsListener = typeof listener === 'function' ? listener : null;
    },

    getRowControls,

    init(nextViewer) {
      viewer = nextViewer || null;
      if (!viewer) return false;
      ensureDetailPanel();
      highlightDataSource?.entities?.removeAll?.();
      if (!highlightDataSource) {
        highlightDataSource = new Cesium.CustomDataSource(
          'anm-mining-highlights',
        );
        viewer.dataSources.add(highlightDataSource);
      }
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
      clearHighlights(highlightDataSource);
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
      if (
        highlightDataSource &&
        viewer?.dataSources?.contains?.(highlightDataSource)
      )
        viewer.dataSources.remove(highlightDataSource, true);
      highlightDataSource = null;
      detailPanel?.remove?.();
      detailPanel = null;
      rowControlsListener = null;
      viewer = null;
      destroyed = true;
    },

    getStats() {
      return {
        count: lastFeatureCount,
        lastUpdate,
        error: lastError,
        category: activeCategory,
        categoryLabel: ANM_CATEGORY_LABELS[activeCategory],
      };
    },

    getParams() {
      return {
        source: 'ANM',
        visibleLayers: [
          ...(ANM_CATEGORY_LAYERS[activeCategory] || DISPLAY_LAYERS),
        ],
        category: activeCategory,
        categories: [
          'titles',
          'applications',
          'subcontracts',
          'special-areas',
          'availability-screening',
        ],
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
