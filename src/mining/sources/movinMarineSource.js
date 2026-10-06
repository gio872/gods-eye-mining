export function createMovinMarineSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  async function snapshot() {
    const response = await fetchImpl('/api/movinmarine/reference', {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(body?.detail || body?.error || 'MovinMarine reference request failed');
    return body;
  }
  return Object.freeze({ snapshot });
}
