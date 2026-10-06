import test from 'node:test';
import assert from 'node:assert/strict';
import { createMovinMarineSource } from './movinMarineSource.js';

test('live MovinMarine source consumes the local structured reference endpoint', async () => {
  const calls = [];
  const source = createMovinMarineSource({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        async json() {
          return {
            provider: 'MovinMarine',
            technology: 'Radar Aéreo M2',
            status: 'LIVE',
            keywords: ['oro', 'cobre', 'geofísica'],
            fetchedAt: '2026-10-06T00:00:00.000Z',
          };
        },
      };
    },
  });
  const snapshot = await source.snapshot();
  assert.equal(snapshot.status, 'LIVE');
  assert.equal(snapshot.provider, 'MovinMarine');
  assert.deepEqual(calls[0].options.headers, { Accept: 'application/json' });
  assert.equal(calls[0].url, '/api/movinmarine/reference');
});
