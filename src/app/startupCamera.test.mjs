import { GLOBAL_MINING_DEFAULT_VIEW } from './viewer.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { flyToAustin } from '../camera.js';

test('teardown before the initial camera delay prevents a late flight', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let flights = 0;
  let cancelled = 0;
  const stop = flyToAustin({
    isDestroyed: () => false,
    camera: {
      setView() {},
      flyTo() {
        flights++;
      },
      cancelFlight() {
        cancelled++;
      },
    },
  });
  stop();
  t.mock.timers.tick(1000);
  assert.equal(flights, 0);
  assert.equal(cancelled, 1);
});


test('GEM default camera view opens on the global Americas mining workspace', () => {
  assert.deepEqual(GLOBAL_MINING_DEFAULT_VIEW, {
    west: -155,
    south: -58,
    east: -25,
    north: 72,
  });
});
