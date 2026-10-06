import { COLOMBIA_DEFAULT_VIEW } from './viewer.js';
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


test('GEM default camera view covers Colombia', () => {
  assert.deepEqual(COLOMBIA_DEFAULT_VIEW, {
    west: -79.35,
    south: -4.35,
    east: -66.80,
    north: 12.65,
  });
});
