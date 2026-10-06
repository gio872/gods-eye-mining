import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnmFreeAreasSource } from './anmFreeAreasSource.js';

test('ANM free areas source builds department and municipality requests', async () => {
  const calls = [];
  const source = createAnmFreeAreasSource({
    fetchImpl: async (url) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ departments: [], municipalities: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  await source.listDepartments();
  await source.listMunicipalities('73');
  assert.match(calls[0], /\/api\/anm-free-areas\/departments$/);
  assert.match(calls[1], /departmentCode=73/);
});
