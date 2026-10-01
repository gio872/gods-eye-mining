const FIELDS=['priceVolatility','liquidityRisk','marketConcentration','demandGrowthRisk'];

export function calculateMarketRisk(input={}) {
  const dimensions=Object.freeze(Object.fromEntries(FIELDS.map(k=>{
    const n=Number(input[k]); return [k,Number.isFinite(n)?Math.max(0,Math.min(100,n)):null];
  })));
  const available=Object.values(dimensions).filter(v=>v!==null).length;
  return Object.freeze({
    mineral:input.mineral ?? null,
    dimensions,
    coveragePercent:Math.round(available/FIELDS.length*100),
    status:available?'PARTIAL':'DATA_REQUIRED',
    source:input.source ?? null,
    observedAt:input.observedAt ?? null,
  });
}
export const MARKET_RISK_FIELDS=Object.freeze(FIELDS);
