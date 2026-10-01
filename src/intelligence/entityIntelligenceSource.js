export function createEntityIntelligenceSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
  token = () => (typeof sessionStorage === 'undefined' ? '' : sessionStorage.getItem('gem.aml.adminToken') || sessionStorage.getItem('gem.camera.adminToken') || ''),
} = {}) {
  const auth = () => {
    const value = String(typeof token === 'function' ? token() : token || '').trim();
    return value ? { Authorization: `Bearer ${value}` } : {};
  };
  async function request(path, options = {}) {
    const response = await fetchImpl(path, {
      cache: 'no-store',
      ...options,
      headers: { Accept: 'application/json', ...auth(), ...(options.headers || {}) },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error || body?.detail || `AML request failed (HTTP ${response.status})`);
    return body;
  }
  return Object.freeze({
    status: () => request('/api/aml/status'),
    screen: (input) => request('/api/aml/screen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  });
}
