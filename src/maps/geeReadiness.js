/**
 * Probe the server-side Earth Engine gateway without holding up map startup.
 * An HTTP 200 is only accepted when the gateway explicitly confirms that its
 * official API initialized; otherwise GEM starts with the public satellite map.
 */
export async function isEarthEngineReady(
  signal,
  { fetchImpl = globalThis.fetch, timeoutMs = 2500 } = {},
) {
  const timeoutController = new AbortController();
  const timeout = setTimeout(
    () => timeoutController.abort(new Error('Earth Engine health timeout')),
    timeoutMs,
  );
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal;
  try {
    const response = await fetchImpl('/api/gee/health', {
      method: 'GET',
      signal: combinedSignal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return false;
    const payload = await response.json();
    return payload?.ok === true && payload?.provider === 'earth-engine';
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
