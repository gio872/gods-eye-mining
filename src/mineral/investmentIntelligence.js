/**
 * GEM Investment Intelligence
 *
 * Converts exploration intelligence into an auditable investment-readiness
 * profile. It never fabricates resources, reserves, grades, NPV or returns.
 */

export const INVESTMENT_INTELLIGENCE_ID = 'GEM-INVESTMENT-INTELLIGENCE';
export const INVESTMENT_INTELLIGENCE_VERSION = '1.0.0';

const clamp = (value, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number(value) || 0));
const finite = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

function readiness(target) {
  const tp = target?.trueProspectivity || {};
  const values = [
    finite(tp.score ?? target?.score),
    finite(tp.confidence),
    finite(tp.coverage),
    finite(tp.explorationPlan?.nextBestAction?.valueScore),
  ].filter((v) => v != null);
  return values.length
    ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
    : 0;
}

function gaps(target) {
  const channels = target?.trueProspectivity?.channels || {};
  return ['geology', 'geophysics', 'geochemistry', 'spectral', 'structure']
    .filter((channel) => channels[channel] == null);
}

export function buildInvestmentProfile(
  target,
  { projectData = null, validatedEconomicData = false } = {},
) {
  const tp = target?.trueProspectivity || {};
  const system = tp.mineralSystem || tp.diagnostics?.mineralSystem || {};
  const contradictions = Number(system.contradictions || 0);
  const decisionReadiness = readiness(target);
  const evidenceGaps = gaps(target);

  const risk =
    contradictions > 0 || decisionReadiness < 35
      ? 'HIGH'
      : decisionReadiness < 60
        ? 'MEDIUM'
        : decisionReadiness < 80
          ? 'CONTROLLED'
          : 'LOW';

  const economic =
    validatedEconomicData && projectData
      ? {
          available: true,
          validated: true,
          capex: finite(projectData.capex),
          opex: finite(projectData.opex),
          npv: finite(projectData.npv),
          irr: finite(projectData.irr),
          resource: projectData.resource ?? null,
        }
      : {
          available: false,
          validated: false,
          capex: null,
          opex: null,
          npv: null,
          irr: null,
          resource: null,
        };

  return {
    engine: {
      id: INVESTMENT_INTELLIGENCE_ID,
      version: INVESTMENT_INTELLIGENCE_VERSION,
    },
    targetId: target?.id || null,
    commodity:
      target?.requestedCommodity ||
      (Array.isArray(target?.commodities) ? target.commodities[0] : null),
    prospectivity: finite(tp.score ?? target?.score),
    confidence: finite(tp.confidence),
    evidenceCoverage: finite(tp.coverage),
    decisionReadiness,
    risk: { level: risk, contradictions, evidenceGaps },
    maturity:
      decisionReadiness >= 80
        ? 'ADVANCED_TARGET'
        : decisionReadiness >= 60
          ? 'PRIORITY_TARGET'
          : decisionReadiness >= 35
            ? 'EARLY_TARGET'
            : 'RECONNAISSANCE',
    nextBestAction: tp.explorationPlan?.nextBestAction || null,
    economic,
    investorState: economic.validated
      ? 'ECONOMIC_MODEL_AVAILABLE'
      : 'TECHNICAL_DUE_DILIGENCE_REQUIRED',
    disclaimer:
      'Decision support only; not a resource/reserve statement, valuation, financial advice or discovery probability.',
  };
}

export function rankInvestmentTargets(targets = [], options = {}) {
  return targets
    .filter(Boolean)
    .map((target) => ({ target, profile: buildInvestmentProfile(target, options) }))
    .sort(
      (a, b) =>
        b.profile.decisionReadiness - a.profile.decisionReadiness ||
        (b.profile.prospectivity || 0) - (a.profile.prospectivity || 0),
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function buildPortfolioSnapshot(targets = [], options = {}) {
  const ranked = rankInvestmentTargets(targets, options);
  const profiles = ranked.map((entry) => entry.profile);
  return {
    engine: { id: INVESTMENT_INTELLIGENCE_ID, version: INVESTMENT_INTELLIGENCE_VERSION },
    targetCount: profiles.length,
    advancedTargets: profiles.filter((p) => p.maturity === 'ADVANCED_TARGET').length,
    priorityTargets: profiles.filter((p) => p.maturity === 'PRIORITY_TARGET').length,
    highRiskTargets: profiles.filter((p) => p.risk.level === 'HIGH').length,
    technicalDueDiligenceRequired: profiles.filter(
      (p) => p.investorState === 'TECHNICAL_DUE_DILIGENCE_REQUIRED',
    ).length,
    topTarget: ranked[0]?.target?.id || null,
    averageReadiness: profiles.length
      ? Math.round(
          (profiles.reduce((sum, p) => sum + p.decisionReadiness, 0) / profiles.length) * 10,
        ) / 10
      : 0,
    ranked,
  };
}
