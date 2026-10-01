/**
 * Transparent criticality analytics.
 * No opaque overall score is emitted: each dimension remains inspectable.
 */
const DIMENSIONS = Object.freeze([
  'supplyRisk','geopoliticalRisk','supplyConcentration','refiningConcentration',
  'substitutionRisk','recyclingConstraint','byProductDependency','strategicImportance'
]);

function score(value) {
  const n=Number(value);
  return Number.isFinite(n) ? Math.max(0,Math.min(100,n)) : null;
}

export function calculateCriticalityDimensions(input={}) {
  return Object.freeze(Object.fromEntries(DIMENSIONS.map(key => [key, score(input[key])])));
}

export function calculateCriticalityCoverage(input={}) {
  const dimensions=calculateCriticalityDimensions(input);
  const available=Object.values(dimensions).filter(v=>v!==null).length;
  return Object.freeze({
    availableDimensions: available,
    totalDimensions: DIMENSIONS.length,
    coveragePercent: Math.round((available / DIMENSIONS.length) * 100),
    dimensions,
    status: available === 0 ? 'DATA_REQUIRED' : available === DIMENSIONS.length ? 'COMPLETE' : 'PARTIAL',
  });
}

export function buildSupplyChainProfile(input={}) {
  const stages=['exploration','mining','concentrate','processing','refining','intermediate','manufacturing','end-use','recycling'];
  return Object.freeze(stages.map(stage => Object.freeze({
    stage,
    countries:Array.isArray(input[stage]?.countries) ? [...input[stage].countries] : [],
    capacity: Number.isFinite(Number(input[stage]?.capacity)) ? Number(input[stage].capacity) : null,
    source: input[stage]?.source ?? null,
    observedAt: input[stage]?.observedAt ?? null,
  })));
}

export function buildSupplyShockScenario({baselineSupply, disruptedSupply, demand, durationMonths=12}={}) {
  const supply=Number(baselineSupply), disrupted=Number(disruptedSupply), required=Number(demand);
  if (![supply,disrupted,required].every(Number.isFinite) || supply<=0) {
    return Object.freeze({status:'DATA_REQUIRED', shortfall:null, shortfallPercent:null, durationMonths});
  }
  const shortfall=Math.max(0,required-disrupted);
  return Object.freeze({
    status:'MODELED',
    baselineSupply:supply,
    disruptedSupply:disrupted,
    demand:required,
    shortfall,
    shortfallPercent:required>0 ? (shortfall/required)*100 : 0,
    durationMonths:Number(durationMonths),
  });
}
export { DIMENSIONS as CRITICALITY_DIMENSIONS };
