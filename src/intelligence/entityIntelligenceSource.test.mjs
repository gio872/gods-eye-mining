import test from 'node:test';
import assert from 'node:assert/strict';
import { createEntityIntelligenceSource } from './entityIntelligenceSource.js';

test('entity intelligence source sends admin auth and returns status', async () => {
  const calls = [];
  const source = createEntityIntelligenceSource({
    token: () => 'aml-secret',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({
        configured: true,
        sources: [{ id: 'ofac-sdn', status: 'provider-ready' }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });

  const result = await source.status();
  assert.equal(result.configured, true);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer aml-secret');
});

test('entity intelligence source posts screening payload', async () => {
  let requestBody = null;
  const source = createEntityIntelligenceSource({
    token: () => 'aml-secret',
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return new Response(JSON.stringify({ query: requestBody.query, sources: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  const result = await source.screen({ query: 'Example Mining Ltd', entityType: 'company' });
  assert.equal(result.query, 'Example Mining Ltd');
  assert.deepEqual(requestBody, { query: 'Example Mining Ltd', entityType: 'company' });
});
