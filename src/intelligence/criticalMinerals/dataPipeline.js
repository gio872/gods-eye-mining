import { normalizeWorldProductionRow } from './sources.js';

export function ingestWorldProduction(rows=[], {source='USGS MCS', year=null}={}) {
  const normalized=[];
  for(const row of rows){
    const item=normalizeWorldProductionRow({...row,source,year:row.year ?? year});
    if(item) normalized.push(item);
  }
  return Object.freeze(normalized);
}

export function aggregateCountryProduction(rows=[]) {
  const map=new Map();
  for(const row of rows){
    const key=`${row.mineral}|${row.country}`;
    map.set(key,(map.get(key)||0)+Number(row.production||0));
  }
  return [...map.entries()].map(([key,production])=>{
    const [mineral,country]=key.split('|');
    return Object.freeze({mineral,country,production});
  });
}

export function concentrationShare(rows=[], mineral) {
  const values=rows.filter(r=>r.mineral===mineral && Number.isFinite(Number(r.production)));
  const total=values.reduce((s,r)=>s+Number(r.production),0);
  if(total<=0) return Object.freeze({mineral,total:0,topCountry:null,topShare:null,status:'DATA_REQUIRED'});
  const sorted=[...values].sort((a,b)=>b.production-a.production);
  return Object.freeze({mineral,total,topCountry:sorted[0]?.country ?? null,topShare:sorted[0].production/total*100,status:'MODELED'});
}
