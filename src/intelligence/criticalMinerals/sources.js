/**
 * Global source registry and normalization boundary.
 * Sources are authoritative references; records are never fabricated locally.
 */
export const CRITICAL_MINERAL_SOURCES=Object.freeze([
  Object.freeze({id:'usgs-mcs-2026',provider:'USGS',kind:'world-production',year:2026,url:'https://www.usgs.gov/data/mineral-commodity-summaries-2026-data-release',coverage:'90+ nonfuel mineral commodities'}),
  Object.freeze({id:'usgs-critical-atlas',provider:'USGS',kind:'country-production',year:2025,url:'https://www.usgs.gov/tools/critical-minerals-atlas',coverage:'180 countries; atlas uses 2023 production data'}),
  Object.freeze({id:'iea-gcmo-2026',provider:'IEA',kind:'supply-demand-risk',year:2026,url:'https://www.iea.org/reports/global-critical-minerals-outlook-2026',coverage:'global critical-minerals outlook'}),
  Object.freeze({id:'eu-crma',provider:'European Commission',kind:'regulatory-taxonomy',year:2024,url:'https://commission.europa.eu/topics/competitiveness/green-deal-industrial-plan/european-critical-raw-materials-act_en',coverage:'EU critical and strategic raw materials'}),
]);

export function getCriticalMineralSources(){ return CRITICAL_MINERAL_SOURCES; }

export function createSourceObservation({sourceId,mineral,country,metric,value,unit,observedAt,evidenceUrl=null}={}) {
  if (!sourceId || !mineral || !metric || !Number.isFinite(Number(value))) return null;
  return Object.freeze({
    sourceId,mineral,country:country ?? null,metric,value:Number(value),unit:unit ?? null,
    observedAt:observedAt ?? null,evidenceUrl:evidenceUrl ?? null,
  });
}

export function normalizeWorldProductionRow(row={}) {
  const mineral=String(row.mineral ?? row.commodity ?? row.name ?? '').trim().toLowerCase();
  const country=String(row.country ?? row.countryName ?? '').trim();
  const production=Number(row.production ?? row.worldProduction ?? row.quantity);
  if(!mineral || !country || !Number.isFinite(production)) return null;
  return Object.freeze({
    mineral,country,production,
    unit:row.unit ?? null,
    year:Number.isFinite(Number(row.year)) ? Number(row.year) : null,
    source:row.source ?? 'USGS MCS',
  });
}
