/**
 * Mining opportunity bridge: joins GEM prospectivity with criticality metadata
 * without inventing supply, reserve, price or demand observations.
 */
export function buildCriticalMineralOpportunity({target, mineralRecord, metrics=null}={}) {
  const score=Number(target?.score);
  return Object.freeze({
    targetId:target?.id ?? null,
    mineral:mineralRecord?.id ?? target?.commodity ?? null,
    prospectivityScore:Number.isFinite(score) ? score : null,
    criticality:metrics?.criticality ?? null,
    supplyChain:metrics?.supplyChain ?? null,
    dataStatus:metrics ? 'SOURCE_PROVIDED' : 'DATA_REQUIRED',
    source:target?.source ?? 'GEM Prospectivity',
    observedAt:target?.observedAt ?? null,
  });
}
