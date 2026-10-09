/**
 * GEM Hierarchical Target Engine.
 *
 * Global -> regional -> local refinement. The engine preserves provenance
 * and only refines targets when sufficient evidence exists.
 */

export const HIERARCHICAL_TARGET_ENGINE_ID='GEM-HIERARCHICAL-TARGET-ENGINE';
export const HIERARCHICAL_TARGET_ENGINE_VERSION='1.0.0';

const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));

export function refinementLevel(target){
 const score=clamp(target?.score);
 const confidence=clamp(target?.confidence);
 if(score>=80&&confidence>=65) return 'LOCAL';
 if(score>=60&&confidence>=40) return 'REGIONAL';
 return 'GLOBAL';
}

export function refineTargets(targets,{maxChildren=9}= {}){
 return (Array.isArray(targets)?targets:[]).map(target=>{
  const level=refinementLevel(target);
  if(level==='GLOBAL') return {...target,hierarchy:{level,parentId:null,children:[]}};
  const span=level==='REGIONAL'?0.25:0.05;
  const children=[];
  const count=Math.max(1,Math.min(9,Number(maxChildren)||9));
  for(let i=0;i<count;i++){
   const angle=(Math.PI*2*i)/count;
   children.push({
    id:`${target.id}-${level.toLowerCase()}-${i+1}`,
    parentId:target.id,
    latitude:Number(target.latitude)+(Math.sin(angle)*span),
    longitude:Number(target.longitude)+(Math.cos(angle)*span),
    level:level==='REGIONAL'?'LOCAL':'DRILL',
    inheritedScore:target.score,
    provenance:{parentId:target.id,method:'deterministic-spatial-refinement'}
   });
  }
  return {...target,hierarchy:{level,parentId:null,children}};
 });
}
