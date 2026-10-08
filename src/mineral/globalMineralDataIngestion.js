/**
 * GEM Global Mineral Data Ingestion Layer.
 * Adapters normalize official statistical releases into immutable, provenance-rich records.
 * Network credentials are never accepted or stored here.
 */
export const GEM_DATA_INGESTION_VERSION='1.0.0';

export const GLOBAL_STATISTICAL_SOURCES=Object.freeze({
  USGS_MCS_2026:Object.freeze({
    id:'usgs-mcs-2026',publisher:'USGS',dataset:'Mineral Commodity Summaries 2026',
    releaseDate:'2026-09-18',format:'CSV',url:'https://www.usgs.gov/data/mineral-commodity-summaries-2026-data-release',
    coverage:'90+ nonfuel mineral commodities'
  }),
  USGS_MINERALS_YEARBOOK:Object.freeze({
    id:'usgs-minerals-yearbook-international',publisher:'USGS',dataset:'Minerals Yearbook Volume III — International',
    format:'CSV/PDF',url:'https://www.usgs.gov/centers/national-minerals-information-center/data',
    coverage:'150+ countries'
  }),
  IEA_CRITICAL_MINERALS:Object.freeze({
    id:'iea-critical-minerals',publisher:'IEA',dataset:'Global Critical Minerals Outlook / Data Explorer',
    format:'dataset',url:'https://www.iea.org/data-and-statistics/data-tools/critical-minerals-data-explorer',
    coverage:'37 critical minerals'
  }),
  UNCTAD_CRITICAL_MINERALS:Object.freeze({
    id:'unctad-critical-minerals',publisher:'UNCTAD',dataset:'Critical Minerals Trade',
    format:'trade-statistics',url:'https://unctadstat.unctad.org/insights/theme/322',
    coverage:'critical-mineral trade'
  }),
  WORLD_BANK_COMMODITIES:Object.freeze({
    id:'world-bank-commodity-markets',publisher:'World Bank',dataset:'Commodity Markets',
    format:'time-series',url:'https://www.worldbank.org/en/research/commodity-markets',
    coverage:'commodity prices'
  })
});

function text(v){return v==null?'':String(v).trim();}
function number(v){if(v==null||v==='')return null;const n=Number(String(v).replace(/,/g,''));return Number.isFinite(n)?n:null;}

export function normalizeMineralStatistic(row,source,{countryField='country',mineralField='mineral',yearField='year',valueField='value',unitField='unit'}={}){
  if(!row||!source) throw new TypeError('row and source are required');
  return Object.freeze({
    ingestionVersion:GEM_DATA_INGESTION_VERSION,
    country:text(row[countryField]),
    mineral:text(row[mineralField]).toLowerCase(),
    year:number(row[yearField]),
    value:number(row[valueField]),
    unit:text(row[unitField])||null,
    sourceId:source.id,
    publisher:source.publisher,
    dataset:source.dataset,
    sourceUrl:source.url||null,
    ingestedAt:new Date().toISOString()
  });
}

export function validateMineralDataset(records=[]){
  const errors=[];
  records.forEach((r,i)=>{
    if(!r.sourceId) errors.push({index:i,error:'MISSING_SOURCE'});
    if(!r.publisher) errors.push({index:i,error:'MISSING_PUBLISHER'});
    if(!r.mineral) errors.push({index:i,error:'MISSING_MINERAL'});
    if(r.value==null) errors.push({index:i,error:'MISSING_VALUE'});
  });
  return Object.freeze({valid:errors.length===0,errorCount:errors.length,errors});
}

export function buildDataManifest(records=[]){
  const sources=[...new Set(records.map(r=>r.sourceId).filter(Boolean))];
  const publishers=[...new Set(records.map(r=>r.publisher).filter(Boolean))];
  const years=[...new Set(records.map(r=>r.year).filter(Number.isFinite))].sort();
  return Object.freeze({
    ingestionVersion:GEM_DATA_INGESTION_VERSION,
    recordCount:records.length,
    sources,
    publishers,
    years,
    generatedAt:new Date().toISOString()
  });
}
