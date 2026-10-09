import test from 'node:test';
import assert from 'node:assert/strict';
import { isEarthEngineReady } from './geeReadiness.js';

test('Earth Engine is used only when the gateway explicitly confirms initialization', async () => {
  const ready = await isEarthEngineReady(undefined, {
    fetchImpl: async () => ({
      ok: true,
      async json() { return { ok: true, provider: 'earth-engine' }; },
    }),
  });
  assert.equal(ready, true);
});

test('a proxy HTTP 200 without a successful Earth Engine health payload uses satellite fallback', async () => {
  for (const payload of [
    { ok: false, provider: 'earth-engine', error: 'authentication required' },
    { provider: 'earth-engine' },
    {},
  ]) {
    const ready = await isEarthEngineReady(undefined, {
      fetchImpl: async () => ({ ok: true, async json() { return payload; } }),
    });
    assert.equal(ready, false);
  }
});

test('Earth Engine health failures and timeouts never block global satellite startup', async () => {
  const failed = await isEarthEngineReady(undefined, {
    timeoutMs: 20,
    fetchImpl: async () => { throw new Error('connection refused'); },
  });
  assert.equal(failed, false);

  const timedOut = await isEarthEngineReady(undefined, {
    timeoutMs: 10,
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      if (signal.aborted) reject(signal.reason);
      else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }),
  });
  assert.equal(timedOut, false);
});
