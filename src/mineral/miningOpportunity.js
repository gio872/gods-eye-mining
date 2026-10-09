/**
 * GEM operational triage for mineral discovery.
 *
 * Separates geological prospectivity from observed mining activity. The
 * resulting discoveryOpportunityScore is an operational ranking, not a
 * probability of discovery or mineral resource estimate.
 */

const DEFAULT_CURRENT_YEAR = 2026;

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function classifyDiscoveryOpportunity(
  target,
  { currentYear = DEFAULT_CURRENT_YEAR } = {},
) {
  const prospectivity = finite(
    target?.trueProspectivity?.score ?? target?.score,
  );
  const activity = finite(target?.miningActivityEvidence?.score);
  const detectionCount = Number(
    target?.miningActivityEvidence?.detectionCount || 0,
  );
  const confirmedCount = Number(
    target?.miningActivityEvidence?.confirmedCount || 0,
  );
  const onsetYears = Array.isArray(target?.miningActivityEvidence?.onsetYears)
    ? target.miningActivityEvidence.onsetYears.filter(Number.isFinite)
    : [];
  const latestOnsetYear = onsetYears.length ? Math.max(...onsetYears) : null;

  const activityCoverage =
    target?.miningActivityEvidence?.coverage === 100
      ? 'covered'
      : target?.miningActivityEvidence?.coverage === 0
        ? 'not_covered'
        : target?.miningActivityEvidence?.coverage == null
          ? 'unknown'
          : 'partial';

  const recentActivity =
    latestOnsetYear != null && latestOnsetYear >= Number(currentYear) - 2;

  const activityFactor = activity == null ? 0 : clamp(activity, 0, 100) / 100;

  // Activity reduces the operational novelty of a discovery target, but never
  // modifies the underlying geological prospectivity score.
  const discoveryOpportunityScore =
    prospectivity == null
      ? null
      : activityCoverage === 'covered' && activity != null
        ? clamp(prospectivity * (1 - 0.65 * activityFactor))
        : prospectivity;

  let classification = 'LOW PRIORITY';

  if (prospectivity != null) {
    if (
      activityCoverage === 'covered' &&
      prospectivity >= 75 &&
      (activity == null || activity <= 15)
    )
      classification = 'DISCOVERY OPPORTUNITY';
    else if (
      activityCoverage === 'covered' &&
      prospectivity >= 70 &&
      activity != null &&
      activity < 35
    )
      classification = 'UNDER-EXPLORED';
    else if (activity != null && activity >= 55)
      classification = 'ACTIVE MINING ZONE';
    else if (recentActivity && activity != null && activity >= 25)
      classification = 'RECENT MINING ACTIVITY';
    else if (prospectivity >= 70 && activityCoverage !== 'covered')
      classification = 'EXPLORATION FRONTIER';
    else if (prospectivity >= 55) classification = 'PROSPECTIVITY';
  }

  const temporalSignal =
    latestOnsetYear == null
      ? 'NO_ONSET'
      : recentActivity
        ? 'RECENT_ONSET'
        : 'ESTABLISHED_ONSET';

  return {
    prospectivityScore:
      prospectivity == null ? null : Math.round(prospectivity * 10) / 10,
    miningActivityScore:
      activity == null ? null : Math.round(activity * 10) / 10,
    discoveryOpportunityScore:
      discoveryOpportunityScore == null
        ? null
        : Math.round(discoveryOpportunityScore * 10) / 10,
    classification,
    activityCoverage,
    temporalSignal,
    recentActivity,
    latestOnsetYear,
    detectionCount,
    confirmedCount,
    temporalEvidence: 'ONSET_RECORD',
    expansionStatus: 'NOT_RESOLVED',
    interpretation:
      classification === 'DISCOVERY OPPORTUNITY'
        ? 'High multisource prospectivity with no nearby published Earthrise mining detections in the covered footprint.'
        : classification === 'UNDER-EXPLORED'
          ? 'High multisource prospectivity with limited observed mining activity in the covered footprint.'
          : classification === 'EXPLORATION FRONTIER'
            ? 'High multisource prospectivity outside the current Earthrise public mining-detector coverage footprint.'
            : classification === 'ACTIVE MINING ZONE'
              ? 'Strong evidence of existing mining activity; prioritize for mine characterization, expansion analysis and reconciliation rather than greenfield discovery.'
              : 'Operational triage combines geological prospectivity with independent mining-activity evidence; it does not alter the geological score.',
  };
}

export function triageTargets(targets, options = {}) {
  return (Array.isArray(targets) ? targets : [])
    .map((target) => ({
      ...target,
      operationalTriage: classifyDiscoveryOpportunity(target, options),
    }))
    .sort((a, b) => {
      const as = a.operationalTriage.discoveryOpportunityScore ?? -1;
      const bs = b.operationalTriage.discoveryOpportunityScore ?? -1;
      return bs - as || Number(b.score || 0) - Number(a.score || 0);
    })
    .map((target, index) => ({
      ...target,
      operationalRank: index + 1,
    }));
}

export function summarizeTriage(targets) {
  const rows = Array.isArray(targets) ? targets : [];
  const counts = {
    discovery: 0,
    underExplored: 0,
    frontier: 0,
    active: 0,
    recent: 0,
  };
  for (const target of rows) {
    const classification = target?.operationalTriage?.classification;
    if (classification === 'DISCOVERY OPPORTUNITY') counts.discovery += 1;
    if (classification === 'UNDER-EXPLORED') counts.underExplored += 1;
    if (classification === 'EXPLORATION FRONTIER') counts.frontier += 1;
    if (classification === 'ACTIVE MINING ZONE') counts.active += 1;
    if (classification === 'RECENT MINING ACTIVITY') counts.recent += 1;
  }
  return counts;
}
