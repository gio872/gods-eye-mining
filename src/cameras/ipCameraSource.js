export function createIpCameraSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
  token = () => (typeof sessionStorage === 'undefined' ? '' : sessionStorage.getItem('gem.camera.adminToken') || ''),
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
    if (!response.ok) throw new Error(body?.error || `IP camera request failed (HTTP ${response.status})`);
    return body;
  }
  return Object.freeze({
    getStatus: () => request('/api/ip-cameras/status'),
    list: () => request('/api/ip-cameras/cameras'),
    add: (camera) => request('/api/ip-cameras/cameras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(camera),
    }),
    update: (id, camera) => request(`/api/ip-cameras/cameras/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(camera),
    }),
    remove: (id) => request(`/api/ip-cameras/cameras/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    stream: (id) => request(`/api/ip-cameras/stream/${encodeURIComponent(id)}`),
  });
}
