import { estimateTargetDepth, getPreciousMetalDefinition, normalizeGlobalOccurrence } from './globalPreciousMetalsTypes.js';

const STATUS_SCORE = Object.freeze({
  producer:1,
  'past producer':0.9,
  'past-producer':0.9,
  prospect:0.7,
  occurrence:0.55,
  showing:0.5,
});

function clamp(value,min=0,max=1){return Math.max(min,Math.min(max,value));}
function normalizedText(...values){return values.filter(Boolean).join(' ').toLowerCase();}

function statusFactor(status){
  const key=String(status||'').trim().toLowerCase();
  return STATUS_SCORE[key]??(key.includes('producer')?0.9:key.includes('prospect')?0.7:0.55);
}

function favorableDepositFactor(commodity,depositType){
  const text=String(depositType||'').toLowerCase();
  if(!text)return 0.45;
  const rules=commodity==='gold'
    ? [/orogenic/,/epitherm/,/gold-quartz/,/low-sulfide/,/sediment-hosted/,/placer/,/porphyry/]
    : commodity==='silver'
      ? [/epitherm/,/polymetallic/,/vein/,/sediment-hosted/,/porphyry/]
      : [/pge/,/platinum/,/ultramaf/,/mafic/,/layered/,/chromite/];
  return clamp(rules.reduce((score,rule)=>score+(rule.test(text)?0.2:0),0)+0.3);
}

export function scoreDocumentedOccurrence(input){
  const row=normalizeGlobalOccurrence(input);
  if(!row)return null;
  const score=clamp(
    0.52 +
    statusFactor(row.developmentStatus)*0.18 +
    (row.grade?0.10:0) +
    favorableDepositFactor(row.commodity,row.depositType)*0.16 +
    (row.depthStatus==='known'?0.04:0),
  );
  return Object.freeze({
    ...row,
    score,
    scoreType:'documented-occurrence',
  });
}

export function scoreProspectivePoint({commodity='gold',occurrenceProximity=0,occurrenceDensity=0,geologyScore=0,magneticScore=0,depositType='',geologyText=''}={}){
  const def=getPreciousMetalDefinition(commodity);
  const proximity=clamp(Number(occurrenceProximity));
  const density=clamp(Number(occurrenceDensity));
  const geology=clamp(Number(geologyScore));
  const magnetic=clamp(Number(magneticScore));
  const deposit=favorableDepositFactor(commodity==='pgm'?'pgm':commodity,depositType);
  const score=clamp(
    proximity*0.32+
    density*0.12+
    geology*0.28+
    magnetic*0.16+
    deposit*0.12,
  );
  const depth=estimateTargetDepth({commodity,geologyText,depositType});
  const evidence=[];
  if(proximity>0.25)evidence.push('known occurrence proximity');
  if(density>0.25)evidence.push('regional occurrence density');
  if(geology>0.25)evidence.push('favorable geology keywords');
  if(magnetic>0.25)evidence.push('EMAG2 magnetic context');
  return Object.freeze({
    commodity:def.id,
    label:def.label,
    score,
    scoreType:'predictive-screening',
    evidence,
    depthEstimate:depth,
    uncertainty:'high',
  });
}

export function createGlobalPreciousMetalsEngine(){
  return Object.freeze({
    scoreDocumentedOccurrence,
    scoreProspectivePoint,
  });
}
