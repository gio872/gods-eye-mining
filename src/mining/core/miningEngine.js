import { createProspectivityEngine } from './prospectivityEngine.js';

function validateSamples(samples) {
  if (!Array.isArray(samples)) {
    throw new TypeError('Samples must be an array');
  }
  return samples;
}

/**
 * Orchestrates GEM analysis without owning rendering, sources, or lifecycle.
 */
export function createMiningEngine(options = {}) {
  const prospectivity = createProspectivityEngine(options);
  const targets = new Map();

  function analyze(samples) {
    const input = validateSamples(samples);
    const ranked = prospectivity.rank(input);
    for (const target of ranked) targets.set(target.id, target);
    return ranked;
  }

  function upsert(sample) {
    const target = prospectivity.score(sample);
    targets.set(target.id, target);
    return target;
  }

  function getTarget(id) {
    return targets.get(id);
  }

  function getTargets() {
    return [...targets.values()].sort((a, b) => b.score - a.score);
  }

  function removeTarget(id) {
    return targets.delete(id);
  }

  function clear() {
    targets.clear();
  }

  return Object.freeze({
    analyze,
    upsert,
    getTarget,
    getTargets,
    removeTarget,
    clear,
    getProspectivityEngine: () => prospectivity,
  });
}
