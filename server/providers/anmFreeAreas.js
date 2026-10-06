const ANM_BASE = 'https://annamineria.anm.gov.co/annageo/rest/services/SIGM/MapSelection/MapServer';
const DEPARTMENT_LAYER = 34;
const MUNICIPALITY_LAYER = 35;
const CELL_LAYER = 7;
const PAGE_SIZE = 2000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CELL_RESULTS = 10000;
const UPSTREAM_TIMEOUT_MS = 25000;

const cache = new Map();

function cleanText(value) {
  return String(value ?? '').trim();
}
function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry || Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}
function cacheSet(key, value) {
  cache.set(key, { at: Date.now(), value });
  return value;
}
async function arcgisQuery(layerId, params) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) body.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  body.set('f', 'json');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${ANM_BASE}/${layerId}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Accept: 'application/json',
        'User-Agent': "GodsEyeView/ANM-FreeAreas",
      },
      body,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`ANM query timed out after ${UPSTREAM_TIMEOUT_MS / 1000}s`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`ANM HTTP ${response.status}`);
  if (payload?.error) throw new Error(payload.error.message || 'ANM query error');
  return payload;
}
function safeWhere(value) {
  return cleanText(value).replace(/'/g, "''");
}
function featureGeometryArea(geometry) {
  return Number(geometry?.area) || Number(geometry?.AREA_HA) || null;
}
async function listDepartments() {
  const key = 'departments';
  const hit = cacheGet(key);
  if (hit) return hit;
  const payload = await arcgisQuery(DEPARTMENT_LAYER, {
    where: '1=1',
    outFields: 'NOMBRE,COD_DPTO',
    returnGeometry: 'false',
    orderByFields: 'NOMBRE ASC',
    resultRecordCount: 100,
  });
  const rows = (payload.features || []).map((feature) => ({
    code: cleanText(feature.attributes?.COD_DPTO),
    name: cleanText(feature.attributes?.NOMBRE),
  })).filter((row) => row.code && row.name);
  return cacheSet(key, rows);
}
async function findDepartment(code) {
  const departments = await listDepartments();
  return departments.find((row) => row.code === cleanText(code)) || null;
}
async function listMunicipalities(departmentCode) {
  const code = cleanText(departmentCode);
  if (!code) return [];
  const key = `municipalities:${code}`;
  const hit = cacheGet(key);
  if (hit) return hit;
  const payload = await arcgisQuery(MUNICIPALITY_LAYER, {
    where: `COD_DPTO = '${safeWhere(code)}'`,
    outFields: 'NOMBRE,COD_DPTO,COD_MPIO,CATEGORIA',
    returnGeometry: 'false',
    orderByFields: 'NOMBRE ASC',
    resultRecordCount: 2000,
  });
  const rows = (payload.features || []).map((feature) => ({
    code: cleanText(feature.attributes?.COD_MPIO),
    departmentCode: cleanText(feature.attributes?.COD_DPTO),
    name: cleanText(feature.attributes?.NOMBRE),
    category: cleanText(feature.attributes?.CATEGORIA),
  })).filter((row) => row.code && row.name);
  return cacheSet(key, rows);
}
async function findMunicipality(departmentCode, municipalityCode) {
  const rows = await listMunicipalities(departmentCode);
  return rows.find((row) => row.code === cleanText(municipalityCode)) || null;
}
async function municipalityFeature(departmentCode, municipalityCode) {
  const payload = await arcgisQuery(MUNICIPALITY_LAYER, {
    where: `COD_DPTO = '${safeWhere(departmentCode)}' AND COD_MPIO = '${safeWhere(municipalityCode)}'`,
    outFields: 'NOMBRE,COD_DPTO,COD_MPIO,CATEGORIA',
    returnGeometry: 'true',
    outSR: 4686,
    resultRecordCount: 1,
  });
  const feature = payload.features?.[0];
  if (!feature?.geometry) throw new Error('ANM no devolvió la geometría del municipio solicitado');
  return feature;
}
function geometryBounds(geometry) {
  const rings = Array.isArray(geometry?.rings) ? geometry.rings : [];
  const points = rings.flat().filter((pair) => Array.isArray(pair) && Number.isFinite(Number(pair[0])) && Number.isFinite(Number(pair[1])));
  if (!points.length) throw new Error('ANM no devolvió una geometría utilizable para el municipio');
  return {
    xmin: Math.min(...points.map(([lon]) => Number(lon))),
    ymin: Math.min(...points.map(([, lat]) => Number(lat))),
    xmax: Math.max(...points.map(([lon]) => Number(lon))),
    ymax: Math.max(...points.map(([, lat]) => Number(lat))),
  };
}
function pointOnSegment(point, a, b) {
  const [x, y] = point;
  const [ax, ay] = a;
  const [bx, by] = b;
  const cross = (y - ay) * (bx - ax) - (x - ax) * (by - ay);
  if (Math.abs(cross) > 1e-10) return false;
  return x >= Math.min(ax, bx) - 1e-10 && x <= Math.max(ax, bx) + 1e-10 &&
    y >= Math.min(ay, by) - 1e-10 && y <= Math.max(ay, by) + 1e-10;
}
function pointInRing(point, ring) {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (pointOnSegment(point, a, b)) return true;
    const xi = Number(a[0]), yi = Number(a[1]);
    const xj = Number(b[0]), yj = Number(b[1]);
    const intersects = ((yi > point[1]) !== (yj > point[1])) &&
      (point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}
function pointInMunicipality(point, geometry) {
  const rings = Array.isArray(geometry?.rings) ? geometry.rings : [];
  if (!rings.length || !point) return false;
  if (!pointInRing(point, rings[0])) return false;
  for (const hole of rings.slice(1)) {
    if (pointInRing(point, hole)) return false;
  }
  return true;
}
async function freeCellsForMunicipality(departmentCode, municipalityCode) {
  const cacheKey = `free:${cleanText(departmentCode)}:${cleanText(municipalityCode)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const municipality = await municipalityFeature(departmentCode, municipalityCode);
  const bounds = geometryBounds(municipality.geometry);
  const cells = [];
  let offset = 0;
  let truncated = false;

  for (;;) {
    const payload = await arcgisQuery(CELL_LAYER, {
      where: "CELL_STATUS_CODE = 'A'",
      geometry: JSON.stringify({
        xmin: bounds.xmin,
        ymin: bounds.ymin,
        xmax: bounds.xmax,
        ymax: bounds.ymax,
        spatialReference: { wkid: 4686 },
      }),
      geometryType: 'esriGeometryEnvelope',
      inSR: 4686,
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'CELL_KEY_ID,CELL_REASON_CODE,CELL_STATUS_CODE,CELL_REOPENING_DATE,AREA_HA,LONGITUD_CENT,LATITUD_CENT,CELL_TYPE',
      returnGeometry: 'true',
      outSR: 4326,
      resultOffset: offset,
      resultRecordCount: PAGE_SIZE,
      orderByFields: 'CELL_KEY_ID ASC',
    });

    const page = payload.features || [];
    cells.push(...page);
    if (!payload.exceededTransferLimit && page.length < PAGE_SIZE) break;
    offset += page.length;
    if (!page.length || cells.length >= MAX_CELL_RESULTS) {
      truncated = Boolean(payload.exceededTransferLimit);
      break;
    }
  }

  const mapped = cells.slice(0, MAX_CELL_RESULTS).map((feature) => {
    const a = feature.attributes || {};
    const centroid = {
      lon: Number(a.LONGITUD_CENT),
      lat: Number(a.LATITUD_CENT),
    };
    return {
      cellKey: cleanText(a.CELL_KEY_ID),
      reasonCode: cleanText(a.CELL_REASON_CODE),
      statusCode: cleanText(a.CELL_STATUS_CODE),
      reopeningDate: a.CELL_REOPENING_DATE || null,
      areaHa: Number.isFinite(Number(a.AREA_HA)) ? Number(a.AREA_HA) : null,
      centroid,
      cellType: cleanText(a.CELL_TYPE),
      geometry: feature.geometry || null,
      _insideMunicipality: pointInMunicipality([centroid.lon, centroid.lat], municipality.geometry),
    };
  }).filter((cell) => cell._insideMunicipality).map(({ _insideMunicipality, ...cell }) => cell);

  const totalHa = mapped.reduce((sum, cell) => sum + (cell.areaHa || 0), 0);

  const result = {
    department: {
      code: cleanText(departmentCode),
      name: cleanText(municipality.attributes?.NOMBRE_DEPARTAMENTO || ''),
    },
    municipality: {
      code: cleanText(municipalityCode),
      name: cleanText(municipality.attributes?.NOMBRE),
      category: cleanText(municipality.attributes?.CATEGORIA),
    },
    municipalityGeometry: municipality.geometry,
    bounds,
    cells: mapped,
    cellCount: mapped.length,
    totalHa,
    truncated,
    retrievedAt: new Date().toISOString(),
    source: {
      provider: 'ANM · AnnA Minería · Sistema de Cuadrícula',
      endpoint: `${ANM_BASE}/${CELL_LAYER}`,
      statusDefinition: 'CELL_STATUS_CODE=A → Disponible',
      areaDefinition: 'Suma de AREA_HA de celdas disponibles cuyo centroide cae dentro del límite municipal.',
    },
    caveat: 'Resultado cartográfico de disponibilidad de celdas AnnA Minería. Las celdas de borde se asignan por centroide y el resultado no constituye certificado de Área Libre.',
  };
  return cacheSet(cacheKey, result);
}

export function anmFreeAreasProxy() {
  const install = (server) => {
    server.middlewares.use('/api/anm-free-areas', async (req, res) => {
      const reply = (status, body) => {
        res.writeHead(status, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        });
        res.end(JSON.stringify(body));
      };
      try {
        const url = new URL(req.url || '/', 'http://localhost');
        if (url.pathname === '/departments' && req.method === 'GET') {
          return reply(200, { departments: await listDepartments() });
        }
        if (url.pathname === '/municipalities' && req.method === 'GET') {
          return reply(200, {
            municipalities: await listMunicipalities(url.searchParams.get('departmentCode')),
          });
        }
        if (url.pathname === '/search' && req.method === 'GET') {
          const departmentCode = cleanText(url.searchParams.get('departmentCode'));
          const municipalityCode = cleanText(url.searchParams.get('municipalityCode'));
          if (!departmentCode || !municipalityCode) return reply(400, { error: 'departmentCode and municipalityCode are required' });
          const [department, municipality] = await Promise.all([
            findDepartment(departmentCode),
            findMunicipality(departmentCode, municipalityCode),
          ]);
          if (!department) return reply(404, { error: 'Department not found in ANM' });
          if (!municipality) return reply(404, { error: 'Municipality not found in ANM' });
          const result = await freeCellsForMunicipality(departmentCode, municipalityCode);
          result.department = department;
          result.municipality = municipality;
          return reply(200, result);
        }
        return reply(404, { error: 'Not found' });
      } catch (error) {
        console.error('[ANM Free Areas]', error?.message || String(error));
        return reply(502, { error: 'ANM free-area query failed', detail: String(error?.message || error).slice(0, 400) });
      }
    });
  };
  return { name: 'anm-free-areas', configureServer: install, configurePreviewServer: install };
}
