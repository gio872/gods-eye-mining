/**
 * GEM Exploration Optimizer.
 *
 * Public-safe deterministic decision layer.
 *
 * It does not claim a discovery probability or economic value. Instead it
 * ranks the next evidence-acquisition action by:
 *   - evidence gap
 *   - expected information gain
 *   - independence from already observed channels
 *   - operational cost/risk supplied by the caller
 *
 * Proprietary learned policies, project costs and model weights should live
 * in the private service layer once GEM is deployed behind an API.
 */

export const EXPLORATION_OPTIMIZER_ID = 'GEM-EXPLORATION-OPTIMIZER';
export const EXPLORATION_OPTIMIZER_VERSION = '1.0.0';

const DEFAULT_ACTIONS = Object.freeze([
  { id: 'GEOLOGY_DETAIL', channel: 'geology', name: 'Detailed geological mapping', cost: 35, speed: 55, independence: 0.85 },
  { id: 'GEOPHYSICS_MAGNETIC', channel: 'geophysics', name: 'High-resolution magnetic survey', cost: 40, speed: 70, independence: 0.82 },
  { id: 'GEOPHYSICS_EM', channel: 'geophysics', name: 'Electromagnetic survey', cost: 55, speed: 62, independence: 0.90 },
  { id: 'GEOCHEMISTRY_SOIL', channel: 'geochemistry', name: 'Soil / stream-sediment geochemistry', cost: 30, speed: 68, independence: 0.92 },
  { id: 'SPECTRAL_HYPERSPECTRAL', channel: 'spectral', name: 'Hyperspectral mineral mapping', cost: 20, speed: 82, independence: 0.78 },
  { id: 'STRUCTURE_MAPPING', channel: 'structure', name: 'Structural / lineament analysis', cost: 18, speed: 76, independence: 0.74 },
  { id: 'FIELD_VALIDATION', channel: 'field', name: 'Field verification / sampling', cost: 65, speed: 48, independence: 0.95 },
  { id: 'DRILL_SCOUT', channel: 'drilling', name: 'Scout drilling', cost: 100, speed: 30, independence: 1.0 },
]);

const clamp = (value, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number(value) || 0));

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeScore(value) {
  const n = finite(value);
  return n == null ? null : clamp(n);
}

function gap(value) {
  const score = normalizeScore(value);
  return score == null ? 100 : clamp(100 - score);
}

function observed(channel, channels) {
  return normalizeScore(channels && channels[channel]) != null;
}

/**
 * Computes a transparent value-of-information proxy.
 *
 * This is deliberately not an economic NPV. It is an exploration prioritizer
 * that can be replaced by a learned/private policy without changing the API.
 */
export function actionValue(action, context = {}) {
  const channels = context.channels || {};
  const targetScore = normalizeScore(context.targetScore) ?? 0;
  const confidence = normalizeScore(context.confidence) ?? 0;
  const channelGap = gap(channels[action.channel]);
  const independence = clamp((finite(action.independence) ?? 0) * 100);
  const cost = Math.max(1, finite(action.cost) ?? 100);
  const speed = clamp(finite(action.speed) ?? 50);

  const uncertainty = 100 - confidence;
  const targetPotential = targetScore * 0.35;
  const informationNeed = channelGap * 0.45 + uncertainty * 0.20;
  const operational = speed * 0.10 + independence * 0.15;
  const raw = targetPotential + informationNeed + operational;

  return clamp(raw / Math.sqrt(cost / 25));
}

export function rankExplorationActions(
  context = {},
  { actions = DEFAULT_ACTIONS, topN = 5 } = {},
) {
  const channels = context.channels || {};
  const candidates = actions
    .filter((action) => action && action.id && action.channel)
    .filter((action) => !observed(action.channel, channels))
    .map((action) => {
      const value = actionValue(action, context);
      return {
        ...action,
        evidenceGap: Math.round(gap(channels[action.channel]) * 10) / 10,
        valueScore: Math.round(value * 10) / 10,
        rationale:
          `Channel "${action.channel}" is ${observed(action.channel, channels) ? 'already observed' : 'not yet observed'}; acquiring it can reduce uncertainty and test the current mineral-system hypothesis.`,
      };
    })
    .sort((a, b) => b.valueScore - a.valueScore);

  return candidates.slice(0, Math.max(1, Number(topN) || 5)).map((action, index) => ({
    ...action,
    rank: index + 1,
  }));
}

export function buildExplorationPlan(context = {}, options = {}) {
  const actions = rankExplorationActions(context, options);
  const confidence = normalizeScore(context.confidence) ?? 0;
  const targetScore = normalizeScore(context.targetScore) ?? 0;

  return {
    optimizer: {
      id: EXPLORATION_OPTIMIZER_ID,
      version: EXPLORATION_OPTIMIZER_VERSION,
    },
    targetScore,
    confidence,
    decisionState:
      targetScore >= 75 && confidence >= 65
        ? 'ADVANCE_TO_VALIDATION'
        : targetScore >= 50
          ? 'ACQUIRE_DISCRIMINATING_EVIDENCE'
          : 'RECONNAISSANCE',
    nextBestAction: actions[0] || null,
    rankedActions: actions,
    interpretation:
      'Deterministic exploration-action ranking. It is not an economic valuation, reserve estimate or discovery probability.',
  };
}
