import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGlobalSurfaceUrl, isGlobalSurfaceWindow } from './gemWorkspaceRoute.js';

test('Global Surface route detection is explicit and case-sensitive', () => {
  assert.equal(isGlobalSurfaceWindow('?gemWorkspace=global-surface'), true);
  assert.equal(isGlobalSurfaceWindow('gemWorkspace=global-surface'), true);
  assert.equal(isGlobalSurfaceWindow('?gemWorkspace=resources'), false);
  assert.equal(isGlobalSurfaceWindow(''), false);
});

test('Global Surface URL preserves the Pinokio origin and unrelated query parameters', () => {
  assert.equal(
    buildGlobalSurfaceUrl('http://127.0.0.1:42004/?token=local#map'),
    'http://127.0.0.1:42004/?token=local&gemWorkspace=global-surface#map',
  );
});
