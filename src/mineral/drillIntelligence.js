/**
 * GEM Drill Intelligence.
 *
 * Deterministic, auditable drill-hypothesis layer.
 * It proposes candidate orientations/depth windows only when the supplied
 * geological/structural evidence supports them. It is not a reserve,
 * resource, grade or discovery-probability model.
 *
 * Proprietary structural priors, learned orientation models and project
 * drilling costs belong in the private service layer.
 */

export const DRILL_INTELLIGENCE_ID='GEM-DRILL-INTELLIGENCE';
export const DRILL_INTELLIGENCE_VERSION='1.0.0';

const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));
const finite=(v)=>Number.isFinite(Number(v))?Number(v):null;
const normAz=(v)=>{
 const n=finite(v); if(n==null)return null;
 return ((n%360)+360)%360;
};

function evidenceScore(v){
 const n=finite(v); return n==null?null:clamp(n);
}

function candidateAzimuths(structure={}){
 const strike=normAz(structure.strike);
 if(strike==null) return [];
 const dipDir=normAz(structure.dipDirection);
 const normal=dipDir!=null?dipDir:((strike+90)%360);
 return [
  {azimuth:normal,reason:'perpendicular to mapped structural strike/dip direction'},
  {azimuth:(normal+180)%360,reason:'reverse orientation for opposite-side structural test'}
 ];
}

export function generateDrillHypotheses(target, evidence={}){
 const geology=evidenceScore(evidence.geology);
 const structure=evidence.structure||{};
 const geochem=evidenceScore(evidence.geochemistry);
 const spectral=evidenceScore(evidence.spectral);
 const geophysics=evidenceScore(evidence.geophysics);
 const score=evidenceScore(target?.score)??0;

 const observed=[geology,geochem,spectral,geophysics].filter(v=>v!=null);
 const support=observed.length?observed.reduce((a,b)=>a+b,0)/observed.length:0;
 const structuralCandidates=candidateAzimuths(structure);

 const hypotheses=(structuralCandidates.length?structuralCandidates:[
   {azimuth:null,reason:'No structural orientation supplied; orientation must be resolved before drilling.'}
 ]).map((candidate,index)=>({
   id:`${target?.id||'TARGET'}-DRILL-H${index+1}`,
   azimuth: candidate.azimuth,
   dip: structure.dip!=null?clamp(Math.abs(structure.dip),0,90):null,
   targetDepthMinM: structure.depthMinM!=null?Math.max(0,finite(structure.depthMinM)):null,
   targetDepthMaxM: structure.depthMaxM!=null?Math.max(0,finite(structure.depthMaxM)):null,
   supportScore:Math.round(clamp((score*0.30+support*0.45+(geophysics??50)*0.15+(spectral??50)*0.10))*10)/10,
   rationale:candidate.reason,
   confirmingEvidence:[
     'geological compatibility',
     geochem!=null?'pathfinder/geochemical anomaly':'additional geochemistry required',
     spectral!=null?'spectral alteration signature':'spectral validation required',
     geophysics!=null?'geophysical response':'geophysical validation required'
   ],
   invalidatingEvidence:[
     'host lithology incompatible with the mineral-system hypothesis',
     'structural orientation inconsistent with the target geometry',
     'independent channels fail to reproduce the anomaly'
   ],
   status: structuralCandidates.length?'HYPOTHESIS':'INSUFFICIENT_ORIENTATION'
 }));
 return hypotheses.sort((a,b)=>b.supportScore-a.supportScore);
}

export function selectDrillDecision(target,evidence={}){
 const hypotheses=generateDrillHypotheses(target,evidence);
 const score=evidenceScore(target?.score)??0;
 const confidence=evidenceScore(target?.confidence)??0;
 const independentCount=[
   evidence.geology,evidence.geophysics,evidence.geochemistry,
   evidence.spectral,evidence.structure
 ].filter(v=>v!=null).length;

 let state='DO_NOT_DRILL';
 if(score>=80&&confidence>=65&&independentCount>=4) state='DRILL_CANDIDATE';
 else if(score>=65&&confidence>=45&&independentCount>=3) state='PRE_DRILL_VALIDATION';
 else if(score>=50&&independentCount>=2) state='ADVANCE_EXPLORATION';

 return {
  engine:{id:DRILL_INTELLIGENCE_ID,version:DRILL_INTELLIGENCE_VERSION},
  targetId:target?.id||null,
  decisionState:state,
  independentEvidenceCount:independentCount,
  hypotheses,
  nextValidation:[
   'resolve structural geometry',
   'confirm independent geochemical response',
   'confirm geophysical/spectral continuity',
   'validate access, permitting and drilling constraints'
  ],
  warning:'Drill geometry is a hypothesis. Final collar, azimuth, dip and depth require qualified geological and drilling review.'
 };
}
