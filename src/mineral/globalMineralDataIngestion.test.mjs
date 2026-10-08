import test from 'node:test';
import assert from 'node:assert/strict';
import { GLOBAL_STATISTICAL_SOURCES, normalizeMineralStatistic, validateMineralDataset, buildDataManifest } from './globalMineralDataIngestion.js';

test('normalizes official mineral statistics with provenance',()=>{
 const source=GLOBAL_STATISTICAL_SOURCES.USGS_MCS_2026;
 const r=normalizeMineralStatistic({country:'Colombia',mineral:'copper',year:'2025',value:'1234',unit:'t'},source);
 assert.equal(r.value,1234); assert.equal(r.publisher,'USGS'); assert.equal(r.sourceId,'usgs-mcs-2026');
 assert.equal(validateMineralDataset([r]).valid,true);
 assert.equal(buildDataManifest([r]).recordCount,1);
});
test('rejects records without mineral values',()=>{
 const source=GLOBAL_STATISTICAL_SOURCES.USGS_MCS_2026;
 const r=normalizeMineralStatistic({country:'X',mineral:'copper',year:2025,value:'',unit:'t'},source);
 assert.equal(validateMineralDataset([r]).valid,false);
});
