/**
 * GEM Mineral Security Index.
 *
 * A transparent indicator, not a political recommendation and not a
 * probability of disruption. Inputs are normalized 0..1 indicators supplied
 * by authoritative datasets or explicitly labelled GEM-derived calculations.
 */
export const GEM_MINERAL_SECURITY_VERSION='1.0.0';

const FACTORS=Object.freeze({
  importDependence:0.18,
  miningConcentration:0.12,
  refiningConcentration:0.18,
  tradeExposure:0.10,
  projectPipeline:0.08,
  domesticCoverage:0.12,
  geologicalPotential:0.10,
  recycling:0.05,
  infrastructure:0.04,
  dataConfidence:0.03
});

function n(v,d=0){const x=Number(v);return Number.isFinite(x)?Math.max(0,Math.min(1,x)):d;}

export function buildMineralSecurityIndex(input={}){
  const i=input.indicators||{};
  const vulnerability =
    n(i.importDependence)*FACTORS.importDependence+
    n(i.miningConcentration)*FACTORS.miningConcentration+
    n(i.refiningConcentration)*FACTORS.refiningConcentration+
    n(i.tradeExposure)*FACTORS.tradeExposure+
    (1-n(i.projectPipeline))*FACTORS.projectPipeline+
    (1-n(i.domesticCoverage))*FACTORS.domesticCoverage+
    (1-n(i.geologicalPotential))*FACTORS.geologicalPotential+
    (1-n(i.recycling))*FACTORS.recycling+
    (1-n(i.infrastructure))*FACTORS.infrastructure;
  const resilience =
    n(i.domesticCoverage)*0.35+
    n(i.geologicalPotential)*0.20+
    n(i.projectPipeline)*0.15+
    n(i.recycling)*0.10+
    n(i.infrastructure)*0.10+
    n(i.dataConfidence)*0.10;
  return Object.freeze({
    version:GEM_MINERAL_SECURITY_VERSION,
    country:String(input.country||''),
    mineral:String(input.mineral||'').toLowerCase(),
    vulnerabilityIndex:Number((vulnerability*100).toFixed(2)),
    resilienceIndex:Number((resilience*100).toFixed(2)),
    inputs:Object.freeze({...i}),
    interpretation:'indicator_only',
    provenance:Array.isArray(input.provenance)?[...input.provenance]:[],
    dataGaps:Array.isArray(input.dataGaps)?[...input.dataGaps]:[]
  });
}

export function rankSecurityGaps(profiles=[]){
  return [...profiles]
    .filter(Boolean)
    .sort((a,b)=>b.vulnerabilityIndex-a.vulnerabilityIndex)
    .map((p,rank)=>({...p,securityGapRank:rank+1}));
}
