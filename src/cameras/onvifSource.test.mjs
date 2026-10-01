import test from 'node:test';
import assert from 'node:assert/strict';
import { createOnvifSource } from './onvifSource.js';

test('ONVIF source authenticates discovery and PTZ requests', async () => {
  const calls = [];
  const source = createOnvifSource({
    token: () => 'admin-secret',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify(url.endsWith('/discover') ? { cameras: [] } : { ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  await source.discover();
  await source.ptz({
    ptz: 'http://192.168.1.50/onvif/ptz_service',
    username: 'operator',
    password: 'secret',
    profileToken: 'profile1',
    action: 'move',
    pan: 0.5,
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer admin-secret');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer admin-secret');
  assert.match(calls[1].options.body, /"action":"move"/);
});

test('ONVIF event requests expose PullPoint state to the client', async () => {
  const source = createOnvifSource({
    token: () => 'admin-secret',
    fetchImpl: async (_url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer admin-secret');
      return new Response(JSON.stringify({ pullPoint: 'http://192.168.1.50/onvif/events', events: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  const result = await source.events({
    events: 'http://192.168.1.50/onvif/events',
    username: 'operator',
    password: 'secret',
  });
  assert.equal(result.events.length, 0);
  assert.match(result.pullPoint, /192\.168\.1\.50/);
});
