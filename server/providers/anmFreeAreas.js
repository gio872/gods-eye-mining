const ANM_BASE = 'https://annamineria.anm.gov.co/annageo/rest/services/SIGM/MapSelection/MapServer';
const DEPARTMENT_LAYER = 34;
const MUNICIPALITY_LAYER = 35;
const CELL_LAYER = 7;
const PAGE_SIZE = 2000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CELL_RESULTS = 10000;

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
  const response = await fetch(`${ANM_BASE}/${layerId}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      Accept: 'application/json',
      'User-Agent': "GodsEyeView/ANM-FreeAreas",
    },
    body,
  });
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
    outFields: 'NOMBRE,COD_DPTO,COD_MPIO,CATEGORIA,AREA_HA',
    returnGeometry: 'true',
    outSR: 4686,
    resultRecordCount: 1,
  });
  const feature = payload.features?.[0];
  if (!feature?.geometry) throw new Error('ANM no devolvió la geometría del municipio solicitado');
  return feature;
}
async function freeCellsForMunicipality(departmentCode, municipalityCode) {
  const municipality = await municipalityFeature(departmentCode, municipalityCode);
  const geometry = municipality.geometry;
  const cells = [];
  let offset = 0;
  let truncated = false;

  for (;;) {
    const payload = await arcgisQuery(CELL_LAYER, {
      where: "CELL_STATUS_CODE = 'A'",
      geometry: JSON.stringify(geometry),
      geometryType: 'esriGeometryPolygon',
      inSR: 4686,
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'CELL_KEY_ID,CELL_REASON_CODE,CELL_STATUS_CODE,CELL_REOPENING_DATE,AREA_HA,LONGITUD_CENT,LATITUD_CENT,CELL_TYPE,CELL_REASON_CODE',
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
    return {
      cellKey: cleanText(a.CELL_KEY_ID),
      reasonCode: cleanText(a.CELL_REASON_CODE),
      statusCode: cleanText(a.CELL_STATUS_CODE),
      reopeningDate: a.CELL_REOPENING_DATE || null,
      areaHa: Number.isFinite(Number(a.AREA_HA)) ? Number(a.AREA_HA) : null,
      centroid: {
        lon: Number(a.LONGITUD_CENT),
        lat: Number(a.LATITUD_CENT),
      },
      cellType: cleanText(a.CELL_TYPE),
      geometry: feature.geometry || null,
    };
  });

  const totalHa = mapped.reduce((sum, cell) => sum + (cell.areaHa || 0), 0);
  const reasonCounts = Object.fromEntries(
    [...new Set(mapped.map((cell) => cell.reasonCode || 'N'))].map((reason) => [
      reason,
      mapped.filter((cell) => (cell.reasonCode || 'N') === reason).length,
    ])
  );

  return {
    department: {
      code: cleanText(departmentCode),
      name: cleanText(municipality.attributes?.NOMBRE_DEPARTAMENTO || ''),
    },
    municipality: {
      code: cleanText(municipalityCode),
      name: cleanText(municipality.attributes?.NOMBRE),
      category: cleanText(municipality.attributes?.CATEGORIA),
    },
    municipalityGeometry: geometry,
    cells: mapped,
    cellCount: mapped.length,
    totalHa,
    truncated,
    retrievedAt: new Date().toISOString(),
    source: {
      provider: 'ANM · AnnA Minería · Sistema de Cuadrícula',
      endpoint: `${ANM_BASE}/${CELL_LAYER}`,
      statusDefinition: 'CELL_STATUS_CODE=A → Disponible',
      areaDefinition: 'Suma de AREA_HA de celdas ANM disponibles que intersectan el municipio.',
    },
    caveat: 'Resultado cartográfico de disponibilidad de celdas AnnA Minería. No constituye certificado de área libre ni garantiza la procedencia legal de una solicitud.',
  };
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
