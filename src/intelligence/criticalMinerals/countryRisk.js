const RISK_FIELDS=['politicalRisk','exportRestrictionRisk','tradeConcentration','governanceRisk','infrastructureRisk'];

function norm(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):null;}

export function calculateCountryMineralRisk(input={}) {
  const dimensions=Object.freeze(Object.fromEntries(RISK_FIELDS.map(k=>[k,norm(input[k])])));
  const available=Object.values(dimensions).filter(v=>v!==null).length;
  return Object.freeze({
    country:input.country ?? null,
    mineral:input.mineral ?? null,
    dimensions,
    coveragePercent:Math.round(available/RISK_FIELDS.length*100),
    status:available?'PARTIAL':'DATA_REQUIRED',
    source:input.source ?? null,
    observedAt:input.observedAt ?? null,
  });
}
export { RISK_FIELDS as COUNTRY_RISK_FIELDS };
