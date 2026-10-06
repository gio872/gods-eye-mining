import { calculateHyperspectralMineralFeatures, calculateSentinel2MineralFeatures, adaptEmitMineralEvidence } from '../core/spectralFeatures.js';

export function createSpectralMineralSource(){
  return Object.freeze({
    calculateSentinel2(bands){return calculateSentinel2MineralFeatures(bands);},
    calculateHyperspectral(input){return calculateHyperspectralMineralFeatures(input);},
    adaptEmit(input){return adaptEmitMineralEvidence(input);},
  });
}
