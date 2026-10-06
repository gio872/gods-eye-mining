import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnmAreaIntelligenceSource } from './anmAreaIntelligenceSource.js';

test('ANM area intelligence source serializes the marked cell envelope and metadata', async () => {
  let requestedUrl = '';
  const source = createAnmAreaIntelligenceSource({
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return {
        ok: true,
        async json() {
          return { generatedAt:'2026-10-06T00:00:00.000Z', score:{value:88,label:'FAVORABLE PARA SCREENING'}, categories:[], diagnostics:{partial:false} };
        },
      };
    },
  });
  const result = await source.analyze({
    id:'ANM-FREE-73001',
    department:{code:'73',name:'Tolima'},
    municipality:{code:'73001',name:'Ibagué'},
    cellCount:2,
    totalHa:240,
    retrievedAt:'2026-10-06T00:00:00.000Z',
    cells:[
      {cellKey:'A',bounds:{west:-75.10,south:4.30,east:-75.00,north:4.40}},
      {cellKey:'B',bounds:{west:-75.00,south:4.35,east:-74.90,north:4.45}},
    ],
  });
  assert.equal(result.score.value,88);
  assert.match(requestedUrl,/\/api\/anm-area-intelligence\?/);
  const params=new URL(requestedUrl,'http://localhost').searchParams;
  assert.equal(params.get('west'),'-75.1');
  assert.equal(params.get('south'),'4.3');
  assert.equal(params.get('east'),'-74.9');
  assert.equal(params.get('north'),'4.45');
  assert.equal(params.get('departmentCode'),'73');
  assert.equal(params.get('municipalityCode'),'73001');
});
