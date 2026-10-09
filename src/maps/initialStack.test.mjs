import test from 'node:test';
import assert from 'node:assert/strict';
import { activateInitialMapStack } from './initialStack.js';

test('a successful Earth Engine map activation stays on the requested source', async () => {
  const calls = [];
  const controller = {
    async setStack(id, options) {
      calls.push({ id, options });
      return { activeId: id, status: 'ready', lastError: null };
    },
  };
  const result = await activateInitialMapStack(controller, 'gee-global-eo');
  assert.equal(result.usedFallback, false);
  assert.equal(result.state.activeId, 'gee-global-eo');
  assert.deepEqual(calls.map((call) => call.id), ['gee-global-eo']);
  assert.equal(calls[0].options.silent, true);
});

test('a healthy gateway with a failed Earth Engine imagery request recovers to Esri satellite', async () => {
  const calls = [];
  const controller = {
    async setStack(id, options) {
      calls.push({ id, options });
      return id === 'gee-global-eo'
        ? { activeId: id, status: 'switching', lastError: 'GEE map request returned 503' }
        : { activeId: id, status: 'ready', lastError: null };
    },
  };
  const result = await activateInitialMapStack(controller, 'gee-global-eo');
  assert.equal(result.usedFallback, true);
  assert.match(result.reason, /503/);
  assert.equal(result.state.activeId, 'esri-imagery');
  assert.deepEqual(calls.map((call) => call.id), ['gee-global-eo', 'esri-imagery']);
});

test('non-GEE startup failures remain the map controller’s responsibility', async () => {
  const calls = [];
  const controller = {
    async setStack(id) {
      calls.push(id);
      return { activeId: 'osm', status: 'ready', lastError: 'Esri tile failure; using OSM' };
    },
  };
  const result = await activateInitialMapStack(controller, 'esri-imagery');
  assert.equal(result.usedFallback, false);
  assert.deepEqual(calls, ['esri-imagery']);
});
