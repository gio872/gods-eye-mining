import { buildSupplyChainProfile } from './criticality.js';

export const SUPPLY_CHAIN_STAGES=Object.freeze([
  'exploration','mining','concentrate','processing','refining','intermediate','manufacturing','end-use','recycling'
]);

export function createSupplyChainSnapshot({mineral, stages={}}={}) {
  return Object.freeze({
    mineral:mineral ?? null,
    stages:buildSupplyChainProfile(stages),
    status:'SOURCE_REQUIRED',
    observedAt:null,
  });
}
