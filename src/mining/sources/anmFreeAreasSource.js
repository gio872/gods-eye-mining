export function createAnmFreeAreasSource({ fetchImpl = (...args) => globalThis.fetch(...args) } = {}) {
  async function request(path) {
    const response = await fetchImpl(path, { cache: 'no-store', headers: { Accept: 'application/json' } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.detail || body?.error || `ANM free areas request failed (HTTP ${response.status})`);
    return body;
  }
  return Object.freeze({
    listDepartments: () => request('/api/anm-free-areas/departments'),
    listMunicipalities: (departmentCode) => request(`/api/anm-free-areas/municipalities?departmentCode=${encodeURIComponent(departmentCode)}`),
    search: (departmentCode, municipalityCode) => request(`/api/anm-free-areas/search?departmentCode=${encodeURIComponent(departmentCode)}&municipalityCode=${encodeURIComponent(municipalityCode)}`),
  });
}
