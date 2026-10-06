function finite(value){const n=Number(value);return Number.isFinite(n)?n:null;}
function clamp(value,min=0,max=1){return Math.max(min,Math.min(max,value));}
function safeRatio(a,b){const x=finite(a),y=finite(b);return x!==null&&y!==null&&Math.abs(y)>1e-12?x/y:null;}
function normalizedDifference(a,b){const x=finite(a),y=finite(b);return x!==null&&y!==null&&Math.abs(x+y)>1e-12?(x-y)/(x+y):null;}
function mean(values){const finiteValues=values.map(finite).filter((v)=>v!==null);return finiteValues.length?finiteValues.reduce((a,b)=>a+b,0)/finiteValues.length:null;}
function softEvidence(value,center,scale){const n=finite(value);if(n===null)return null;return 1/(1+Math.exp(-(n-center)/scale));}

export const SENTINEL2_MINERAL_FEATURE_DEFINITIONS=Object.freeze([
  Object.freeze({id:'ferric-iron-ratio',label:'Ferric iron proxy',formula:'B4 / B3',source:'Sentinel-2'}),
  Object.freeze({id:'iron-oxide-nd',label:'Iron oxide normalized difference',formula:'(B4-B2)/(B4+B2)',source:'Sentinel-2'}),
  Object.freeze({id:'ferrous-iron-ratio',label:'Ferrous iron proxy',formula:'(B3+B12)/(B4+B8)',source:'Sentinel-2'}),
  Object.freeze({id:'hydroxyl-clay-ratio',label:'OH/clay proxy',formula:'B11/B12',source:'Sentinel-2'}),
  Object.freeze({id:'silica-proxy',label:'Silica-rich surface proxy',formula:'B11/B4',source:'Sentinel-2'}),
  Object.freeze({id:'hydrothermal-sabin',label:'Hydrothermal alteration proxy A',formula:'B4/B2 + B6/B11 + B11/B12',source:'Sentinel-2'}),
  Object.freeze({id:'hydrothermal-alternative',label:'Hydrothermal alteration proxy B',formula:'B4/B3 + B6/B11 + B11/B12',source:'Sentinel-2'}),
  Object.freeze({id:'ndvi',label:'Vegetation index',formula:'(B8-B4)/(B8+B4)',source:'Sentinel-2'}),
]);

export function calculateSentinel2MineralFeatures(input={}){
  const B2=finite(input.B2??input.b02??input.blue);
  const B3=finite(input.B3??input.b03??input.green);
  const B4=finite(input.B4??input.b04??input.red);
  const B6=finite(input.B6??input.b06);
  const B8=finite(input.B8??input.b08??input.nir);
  const B11=finite(input.B11??input.b11??input.swir16);
  const B12=finite(input.B12??input.b12??input.swir22);
  const ferricIronRatio=safeRatio(B4,B3);
  const ironOxideNd=normalizedDifference(B4,B2);
  const ferrousIronRatio=(B3!==null&&B12!==null&&B4!==null&&B8!==null)?(B3+B12)/(B4+B8):null;
  const hydroxylClayRatio=safeRatio(B11,B12);
  const silicaProxy=safeRatio(B11,B4);
  const hydrothermalSabin=(B4!==null&&B2!==null&&B6!==null&&B11!==null&&B12!==null)?B4/B2+B6/B11+B11/B12:null;
  const hydrothermalAlternative=(B4!==null&&B3!==null&&B6!==null&&B11!==null&&B12!==null)?B4/B3+B6/B11+B11/B12:null;
  const ndvi=normalizedDifference(B8,B4);
  const exposedSurface=ndvi===null?null:clamp((0.45-ndvi)/0.8);
  const candidateScores=[
    softEvidence(ironOxideNd,.1,.12),
    ferricIronRatio===null?null:softEvidence(Math.log(Math.max(ferricIronRatio,.05)),Math.log(1.4),.35),
    hydroxylClayRatio===null?null:softEvidence(Math.log(Math.max(hydroxylClayRatio,.05)),Math.log(1.25),.28),
    ferrousIronRatio===null?null:softEvidence(Math.log(Math.max(ferrousIronRatio,.05)),Math.log(1.0),.32),
    hydrothermalSabin===null?null:softEvidence(hydrothermalSabin,3.0,.8),
    silicaProxy===null?null:softEvidence(Math.log(Math.max(silicaProxy,.05)),Math.log(1.0),.5),
  ].filter((v)=>v!==null);
  const rawScore=mean(candidateScores);
  const spectralScore=rawScore===null?null:clamp(rawScore*(exposedSurface===null?1:.65+.35*exposedSurface));
  const evidenceChannels={};
  if(ferricIronRatio!==null)evidenceChannels.ferricIron=ferricIronRatio;
  if(ironOxideNd!==null)evidenceChannels.ironOxideNd=ironOxideNd;
  if(ferrousIronRatio!==null)evidenceChannels.ferrousIron=ferrousIronRatio;
  if(hydroxylClayRatio!==null)evidenceChannels.hydroxylClay=hydroxylClayRatio;
  if(silicaProxy!==null)evidenceChannels.silicaProxy=silicaProxy;
  if(hydrothermalSabin!==null)evidenceChannels.hydrothermalSabin=hydrothermalSabin;
  if(hydrothermalAlternative!==null)evidenceChannels.hydrothermalAlternative=hydrothermalAlternative;
  if(ndvi!==null)evidenceChannels.ndvi=ndvi;
  return Object.freeze({
    sensor:'Sentinel-2 MSI',
    spectralScore,
    features:Object.freeze(evidenceChannels),
    bands:Object.freeze({B2,B3,B4,B6,B8,B11,B12}),
    interpretation:Object.freeze({
      ironOxides:'proxy for ferric iron/oxidation; not a mineral-species identification',
      hydroxylClay:'proxy for OH-bearing/clay alteration',
      silica:'surface spectral contrast proxy; not direct quartz identification',
      hydrothermal:'alteration proxy requiring lithologic/structural context',
      vegetationMask:ndvi===null?'unavailable':ndvi,
    }),
    confidence:spectralScore===null?'none':'screening',
  });
}

function interpolate(wavelengths,values,target){
  const pairs=Array.from({length:Math.min(wavelengths.length,values.length)},(_,i)=>[finite(wavelengths[i]),finite(values[i])]).filter(([w,v])=>w!==null&&v!==null).sort((a,b)=>a[0]-b[0]);
  if(!pairs.length)return null;
  if(target<=pairs[0][0])return pairs[0][1];
  if(target>=pairs[pairs.length-1][0])return pairs[pairs.length-1][1];
  for(let i=1;i<pairs.length;i++){
    const [w2,v2]=pairs[i],[w1,v1]=pairs[i-1];
    if(target>=w1&&target<=w2){
      const t=(target-w1)/(w2-w1||1);
      return v1+(v2-v1)*t;
    }
  }
  return null;
}

function continuumDepth(wavelengths,values,center,left,right){
  const rCenter=interpolate(wavelengths,values,center);
  const rLeft=interpolate(wavelengths,values,left);
  const rRight=interpolate(wavelengths,values,right);
  if([rCenter,rLeft,rRight].some((v)=>v===null))return null;
  const t=(center-left)/(right-left);
  const continuum=rLeft+(rRight-rLeft)*t;
  if(!Number.isFinite(continuum)||continuum<=0)return null;
  return clamp(1-rCenter/continuum,-1,1);
}

export function calculateHyperspectralMineralFeatures({wavelengths=[],values=[],sensor='hyperspectral'}={}){
  if(!Array.isArray(wavelengths)||!Array.isArray(values)||wavelengths.length<5||values.length<5)return Object.freeze({sensor,spectralScore:null,features:{},confidence:'none'});
  const iron1000=continuumDepth(wavelengths,values,1000,820,1100);
  const alOH2200=continuumDepth(wavelengths,values,2200,2050,2350);
  const mgOH2300=continuumDepth(wavelengths,values,2300,2150,2400);
  const feOH2250=continuumDepth(wavelengths,values,2250,2100,2350);
  const channels=[iron1000,alOH2200,mgOH2300,feOH2250].filter((v)=>v!==null).map((v)=>clamp((v+.02)/.12));
  const spectralScore=channels.length?mean(channels):null;
  return Object.freeze({
    sensor,
    spectralScore,
    features:Object.freeze({iron1000,alOH2200,mgOH2300,feOH2250}),
    confidence:channels.length?'screening':'none',
    interpretation:Object.freeze({
      iron1000:'continuum-removed VNIR absorption proxy',
      alOH2200:'continuum-removed Al-OH absorption proxy',
      mgOH2300:'continuum-removed Mg-OH absorption proxy',
      feOH2250:'continuum-removed Fe-OH absorption proxy',
    }),
  });
}

export function adaptEmitMineralEvidence(input={}){
  const groups=[1,2].map((group)=>{
    const mineral=input[`group${group}Mineral`]??input[`group${group}Id`]??null;
    const bandDepth=finite(input[`group${group}BandDepth`]);
    const uncertainty=finite(input[`group${group}Uncertainty`]);
    const fitScore=finite(input[`group${group}FitScore`]??input[`group${group}R2`]);
    return {group,mineral,bandDepth,uncertainty,fitScore};
  });
  const usable=groups.filter((row)=>row.bandDepth!==null||row.fitScore!==null);
  const weighted=usable.map((row)=>{
    const depth=row.bandDepth===null?0:clamp(row.bandDepth/.15);
    const fit=row.fitScore===null?1:clamp(row.fitScore);
    const uncertaintyPenalty=row.uncertainty===null?1:clamp(1-row.uncertainty/.05);
    return depth*fit*uncertaintyPenalty;
  });
  return Object.freeze({
    sensor:'EMIT L2B MIN',
    spectralScore:weighted.length?clamp(mean(weighted)):null,
    mineralGroups:Object.freeze(groups),
    confidence:weighted.length?'screening':'none',
    sourceProduct:'EMITL2BMIN',
  });
}
