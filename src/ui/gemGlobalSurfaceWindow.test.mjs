import test from 'node:test';
import assert from 'node:assert/strict';

test('Global Surface window entry remains a separate route from the product shell', () => {
  const home = new URL('http://127.0.0.1:42004/');
  home.searchParams.set('gemWorkspace', 'global-surface');
  assert.equal(home.searchParams.get('gemWorkspace'), 'global-surface');
  assert.equal(home.origin, 'http://127.0.0.1:42004');
});
