import { createSubsurfaceObservation } from '../core/geophysicsTypes.js';

const HEADER_ALIASES = Object.freeze({
  id:['id','sample_id','observation_id','target_id'],
  latitude:['latitude','lat','y','y_coord','ycoordinate'],
  longitude:['longitude','lon','lng','x','x_coord','xcoordinate'],
  depth:['depth','depth_m','depthmeter','z_depth'],
  depthTopM:['depth_top','depth_top_m','top_depth'],
  depthBottomM:['depth_bottom','depth_bottom_m','bottom_depth'],
  value:['value','signal','conductivity','amplitude','measurement','z','anomaly','response'],
  intensity:['intensity','anomaly_intensity','anomaly_score','strength','value','signal','conductivity','amplitude'],
  unit:['unit','units'],
  modality:['modality','method','geophysics','geophysical_method'],
  mineral:['mineral','commodity','target','target_mineral'],
  directionDeg:['direction','direction_deg','azimuth','bearing'],
  confidence:['confidence','quality','certainty'],
  source:['source','dataset','survey','campaign'],
  surveyDate:['survey_date','date','acquisition_date'],
});
function key(value){return String(value??'').trim().toLowerCase().replace(/[\s\-]+/g,'_');}
function finite(value){const n=Number(String(value??'').replace(',','.'));return Number.isFinite(n)?n:null;}
function pickIndex(headers,aliases){return aliases.map((alias)=>headers.indexOf(alias)).find((index)=>index>=0)??-1;}
function splitLine(line, whitespace=false){
  if(whitespace) return line.trim().split(/\\s+/).map((part)=>part.trim());
  if(line.includes(';')&&!line.includes(',')) return line.split(';').map((part)=>part.trim());
  return line.split(',').map((part)=>part.trim());
}
function parseCsv(text,whitespace=false){
  const lines=String(text??'').split(/\r?\n/).map((line)=>line.trim()).filter(Boolean);
  if(!lines.length)return [];
  const headers=splitLine(lines[0],whitespace).map(key);
  const indices=Object.fromEntries(Object.entries(HEADER_ALIASES).map(([name,aliases])=>[name,pickIndex(headers,aliases)]));
  return lines.slice(1).map((line,rowIndex)=>{
    const parts=splitLine(line,whitespace);
    const get=(name)=>indices[name]>=0?parts[indices[name]]:undefined;
    const depth=finite(get('depth'));
    return {
      id:get('id')||'row-'+(rowIndex+1),latitude:finite(get('latitude')),longitude:finite(get('longitude')),
      depthTopM:finite(get('depthTopM'))??depth??0,depthBottomM:finite(get('depthBottomM'))??depth??0,
      value:finite(get('value'))??0,intensity:finite(get('intensity')),unit:get('unit'),
      modality:get('modality')||'unknown',mineral:get('mineral')||'unknown',directionDeg:finite(get('directionDeg')),
      confidence:finite(get('confidence'))??0,source:get('source')||'GEM file import',surveyDate:get('surveyDate')||null,
    };
  }).filter((row)=>row.latitude!==null&&row.longitude!==null);
}
function findProperty(properties,aliases){
  for(const alias of aliases){
    if(properties?.[alias]!==undefined)return properties[alias];
    const match=Object.keys(properties||{}).find((name)=>key(name)===key(alias));
    if(match)return properties[match];
  }
  return undefined;
}
function fromGeoJsonFeature(feature,index){
  const properties=feature?.properties||{}, coordinates=feature?.geometry?.coordinates;
  let longitude=null,latitude=null,depth=null;
  if(feature?.geometry?.type==='Point'){longitude=finite(coordinates?.[0]);latitude=finite(coordinates?.[1]);depth=finite(coordinates?.[2]);}
  return {
    id:findProperty(properties,HEADER_ALIASES.id)||'feature-'+(index+1),latitude,longitude,
    depthTopM:finite(findProperty(properties,HEADER_ALIASES.depthTopM))??depth??0,
    depthBottomM:finite(findProperty(properties,HEADER_ALIASES.depthBottomM))??depth??0,
    value:finite(findProperty(properties,HEADER_ALIASES.value))??0,intensity:finite(findProperty(properties,HEADER_ALIASES.intensity)),
    unit:findProperty(properties,HEADER_ALIASES.unit),modality:findProperty(properties,HEADER_ALIASES.modality)||'unknown',
    mineral:findProperty(properties,HEADER_ALIASES.mineral)||'unknown',directionDeg:finite(findProperty(properties,HEADER_ALIASES.directionDeg)),
    confidence:finite(findProperty(properties,HEADER_ALIASES.confidence))??0,source:findProperty(properties,HEADER_ALIASES.source)||'GeoJSON import',
    surveyDate:findProperty(properties,HEADER_ALIASES.surveyDate)||null,
  };
}
function parseJson(text){
  const payload=JSON.parse(text);
  if(payload?.type==='FeatureCollection')return (payload.features||[]).map(fromGeoJsonFeature).filter((row)=>row.latitude!==null&&row.longitude!==null);
  const rows=Array.isArray(payload)?payload:payload?.observations;
  if(!Array.isArray(rows))throw new Error('JSON debe ser FeatureCollection, array u {observations:[]}');
  return rows.map((row,index)=>({...row,id:row.id||'row-'+(index+1),latitude:row.latitude??row.lat??row.y,longitude:row.longitude??row.lon??row.lng??row.x,depthTopM:row.depthTopM??row.depth_top_m??row.depth??row.z_depth??0,depthBottomM:row.depthBottomM??row.depth_bottom_m??row.depth??row.z_depth??0,intensity:row.intensity??row.anomaly_intensity??row.value??row.signal})).filter((row)=>Number.isFinite(Number(row.latitude))&&Number.isFinite(Number(row.longitude)));
}
export function parseGeophysicalText(text,filename='data.csv'){
  const name=String(filename).toLowerCase();
  const isJson=name.endsWith('.json')||name.endsWith('.geojson');
  const isXyz=name.endsWith('.xyz')||name.endsWith('.txt');
  const rows=isJson?parseJson(text):parseCsv(text,isXyz);
  return rows.map((row,index)=>createSubsurfaceObservation({...row,id:row.id||'observation-'+(index+1)}));
}
export async function ingestGeophysicalFile(file){
  if(!file||typeof file.text!=='function')throw new TypeError('Archivo geofísico inválido');
  return parseGeophysicalText(await file.text(),file.name);
}
export function serializeObservationsToGeoJson(rows=[]){
  return JSON.stringify({
    type:'FeatureCollection',name:'GEM Subsurface Observations',
    features:rows.map((row)=>({type:'Feature',properties:{id:row.id,depthTopM:row.depthTopM,depthBottomM:row.depthBottomM,depthM:row.depthM,value:row.value,unit:row.unit,modality:row.modality,mineral:row.mineral,intensity:row.intensity,directionDeg:row.directionDeg,confidence:row.confidence,source:row.source,surveyDate:row.surveyDate},geometry:{type:'Point',coordinates:[row.longitude,row.latitude,row.depthM]}})),
  },null,2);
}
