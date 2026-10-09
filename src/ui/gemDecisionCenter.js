/**
 * GEM Decision Center
 * Real-time decision surface for selected exploration targets.
 * Uses only evidence already produced by GEM; never fabricates economics.
 */

function number(value, digits = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : '—';
}

function row(label, value, tone = '') {
  return '<div class="gem-decision-row"><span>' + label + '</span><b class="' + tone + '">' + value + '</b></div>';
}

function evidenceRows(target) {
  const channels = target?.trueProspectivity?.channels || {};
  const labels = {
    geology: 'Geology',
    geophysics: 'Geophysics',
    geochemistry: 'Geochemistry',
    spectral: 'Spectral',
    structure: 'Structure',
    terrain: 'Terrain',
    hydrology: 'Hydrology',
    environment: 'Environment',
    access: 'Access',
  };
  return Object.entries(labels)
    .filter(([key]) => channels[key] != null)
    .map(([key, label]) => row(label, number(channels[key], 0) + '%'))
    .join('');
}

function render(panel, target, stage = 'DECISION_READY') {
  if (!target) {
    panel.innerHTML =
      '<div class="gem-decision-kicker">GEM DECISION CENTER</div>' +
      '<strong>Select a target</strong><small>GEM will show evidence, risk, next action and investment readiness here.</small>';
    return;
  }

  const tp = target.trueProspectivity || {};
  const investment = target.investmentIntelligence || {};
  const plan = tp.explorationPlan || {};
  const action = plan.nextBestAction || {};
  const system = tp.mineralSystem || tp.diagnostics?.mineralSystem || {};
  const contradictions = Number(system.contradictions || 0);
  const gaps = ['geology', 'geophysics', 'geochemistry', 'spectral', 'structure']
    .filter((key) => tp.channels?.[key] == null);
  const readiness = investment.decisionReadiness ?? 0;
  const risk = investment.risk?.level || (contradictions ? 'HIGH' : 'UNASSESSED');

  panel.innerHTML =
    '<div class="gem-decision-head"><div><span class="gem-decision-kicker">GEM DECISION CENTER</span><strong>' +
    (target.id || 'TARGET') +
    '</strong></div><button data-close aria-label="Close">×</button></div>' +
    '<div class="gem-decision-stage">' + stage.replaceAll('_', ' ') + '</div>' +
    '<div class="gem-decision-score"><b>' + number(tp.score ?? target.score) + '</b><span>PROSPECTIVITY</span><b>' +
    number(tp.confidence) + '</b><span>CONFIDENCE</span><b>' + number(readiness) + '</b><span>INVESTMENT READINESS</span></div>' +
    '<section><h4>WHY THIS TARGET</h4>' +
    '<p>' + (tp.interpretation || target.interpretation || 'Multisource evidence is still being evaluated.') + '</p></section>' +
    '<section><h4>EVIDENCE CONVERGENCE</h4><div class="gem-decision-grid">' +
    evidenceRows(target) +
    '</div></section>' +
    '<section><h4>RISK & GAPS</h4>' +
    row('Risk', risk, risk === 'LOW' ? 'good' : risk === 'HIGH' ? 'bad' : '') +
    row('Contradictions', String(contradictions)) +
    row('Missing channels', gaps.length ? gaps.join(', ') : 'None') +
    '</section>' +
    '<section><h4>NEXT BEST ACTION</h4>' +
    '<strong class="gem-decision-action">' + (action.label || action.action || 'Acquire discriminating evidence') + '</strong>' +
    '<small>' + (action.reason || action.rationale || 'Reduce the largest evidence gap before escalation.') + '</small></section>' +
    '<section><h4>INVESTOR GATE</h4>' +
    row('Maturity', investment.maturity || 'EARLY_TARGET') +
    row('State', investment.investorState || 'TECHNICAL_DUE_DILIGENCE_REQUIRED') +
    row('Economics', investment.economic?.validated ? 'VALIDATED DATA AVAILABLE' : 'NOT YET VALIDATED') +
    '</section>';
  panel.querySelector('[data-close]')?.addEventListener('click', () => {
    panel.classList.remove('is-open');
  });
}

export function installGemDecisionCenter() {
  const install = () => {
    if (document.querySelector('.gem-decision-center')) return;
    const panel = document.createElement('aside');
    panel.className = 'gem-decision-center';
    const style = document.createElement('style');
    style.textContent = [
      '.gem-decision-center{position:fixed;right:18px;bottom:18px;width:390px;max-height:72vh;overflow:auto;z-index:12000;display:none;padding:16px;background:rgba(7,12,18,.96);border:1px solid rgba(80,210,230,.42);box-shadow:0 18px 60px rgba(0,0,0,.45);backdrop-filter:blur(14px);color:#dcecf0;font:12px/1.45 Inter,system-ui,sans-serif}',
      '.gem-decision-center.is-open{display:block}.gem-decision-head{display:flex;justify-content:space-between;align-items:flex-start}.gem-decision-head strong{display:block;font:700 20px/1.1 ui-monospace,monospace;margin-top:3px}.gem-decision-head button{background:none;border:0;color:#9eb6bd;font-size:22px;cursor:pointer}.gem-decision-kicker{font-size:10px;letter-spacing:.16em;color:#58d5e8}.gem-decision-stage{margin:10px 0;padding:5px 8px;border:1px solid #31505a;color:#7fe4ef;font:10px ui-monospace,monospace}.gem-decision-score{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.gem-decision-score b{font:700 22px ui-monospace,monospace}.gem-decision-score span{font-size:8px;color:#7f969d;letter-spacing:.08em}.gem-decision-center section{border-top:1px solid rgba(130,170,180,.18);padding:10px 0}.gem-decision-center h4{margin:0 0 7px;font-size:9px;letter-spacing:.14em;color:#7f969d}.gem-decision-center p{margin:0;color:#c9dadd}.gem-decision-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}.gem-decision-row{display:flex;justify-content:space-between;gap:8px;padding:4px 0}.gem-decision-row span{color:#849ba2}.gem-decision-row b{font-family:ui-monospace,monospace}.gem-decision-row b.good{color:#6fe2a0}.gem-decision-row b.bad{color:#ff7d70}.gem-decision-action{display:block;color:#75e0ec;margin-bottom:4px}.gem-decision-center small{display:block;color:#849ba2}.gem-decision-center strong{color:#e6f5f7}',
    ].join('');
    document.head.append(style);
    document.body.append(panel);

    document.addEventListener('gem:target-selected', (event) => {
      render(panel, event.detail, 'DECISION_READY');
      panel.classList.add('is-open');
    });

    document.addEventListener('gem:global-intelligence-state', (event) => {
      const detail = event.detail || {};
      if (!panel.classList.contains('is-open')) return;
      const selectedId = panel.querySelector('.gem-decision-head strong')?.textContent;
      const target = (detail.targets || []).find((item) => item.id === selectedId);
      if (target) render(panel, target, detail.phase || 'SCANNING');
    });
  };

  if (document.body) install();
  else document.addEventListener('DOMContentLoaded', install, { once: true });
}
