import { createSubsurfaceObservation, createSubsurfaceTarget } from './geophysicsTypes.js';

function finite(value) { return Number.isFinite(Number(value)) ? Number(value) : null; }
function clamp01(value) { const n=finite(value); return n===null?0:Math.min(1,Math.max(0,n)); }
function normalizeIntensity(values) {
  const finiteValues=values.map(finite).filter((value)=>value!==null);
  if(!finiteValues.length) return values.map(()=>0);
  const min=Math.min(...finiteValues), max=Math.max(...finiteValues);
  if(max===min) return values.map((value)=>finite(value)===null?0:0.5);
  return values.map((value)=>{const n=finite(value);return n===null?0:clamp01((n-min)/(max-min));});
}
function depthSuitability(depthM,maxDepthM=5000) {
  const depth=Math.max(0,finite(depthM,0)), max=Math.max(1,finite(maxDepthM,5000));
  return clamp01(1-depth/max);
}

export function createGeophysicsEngine({
  maxDepthM=5000, anomalyWeight=0.68, confidenceWeight=0.22, depthWeight=0.10,
}={}) {
  const total=Math.max(0.0001,Number(anomalyWeight)+Number(confidenceWeight)+Number(depthWeight));
  const weights={anomaly:Number(anomalyWeight)/total,confidence:Number(confidenceWeight)/total,depth:Number(depthWeight)/total};

  function normalizeObservations(rows=[]) {
    return rows.map((row,index)=>createSubsurfaceObservation({ ...row, id:row?.id || 'observation-' + (index+1) }));
  }
  function rank(rows=[]) {
    const observations=normalizeObservations(rows);
    const anomalyValues=normalizeIntensity(observations.map((row)=>row.intensity));
    return observations.map((observation,index)=>{
      const anomalyScore=anomalyValues[index] ?? 0;
      const depthScore=depthSuitability(observation.depthM,maxDepthM);
      const score=anomalyScore*weights.anomaly+observation.confidence*weights.confidence+depthScore*weights.depth;
      return createSubsurfaceTarget({
        id:'gem-subsurface-target-' + observation.id, observation, score, anomalyScore, depthScore,
        confidence:observation.confidence,
      });
    }).sort((a,b)=>b.score-a.score);
  }
  return Object.freeze({ rank, normalizeObservations, getWeights:()=>Object.freeze({ ...weights }) });
}
