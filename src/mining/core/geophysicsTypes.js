/** GEM subsurface geophysics domain primitives. */

export const GEOPHYSICS_MODALITIES = Object.freeze([
  'electromagnetic','conductivity','magnetic','radiometric','thermal','seismic','gravity','unknown',
]);

export const GEOPHYSICS_MINERALS = Object.freeze([
  'gold','copper','zinc','silver','lithium','rare-earth-elements','coltan','tantalite','tungsten','manganese','pgm','unknown',
]);

function finite(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function clean(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}
function normalize01(value, fallback = 0) {
  const n = finite(value, fallback);
  return Math.min(1, Math.max(0, n));
}

export function createSubsurfaceObservation({
  id, latitude, longitude, depthTopM = 0, depthBottomM = depthTopM, value = 0, unit = '',
  modality = 'unknown', mineral = 'unknown', intensity = value, directionDeg = null,
  confidence = 0, source = 'GEM import', surveyDate = null, metadata = {},
} = {}) {
  if (!clean(id)) throw new TypeError('A subsurface observation id is required');
  const lat = finite(latitude), lon = finite(longitude);
  if (lat === null || lon === null) throw new TypeError('A valid latitude and longitude are required');
  const top = Math.max(0, finite(depthTopM, 0));
  const bottom = Math.max(top, finite(depthBottomM, top));
  const resolvedModality = GEOPHYSICS_MODALITIES.includes(modality) ? modality : 'unknown';
  const resolvedMineral = GEOPHYSICS_MINERALS.includes(mineral) ? mineral : clean(mineral, 'unknown');
  return Object.freeze({
    id: clean(id), latitude: lat, longitude: lon, depthTopM: top, depthBottomM: bottom,
    depthM: (top + bottom) / 2, value: finite(value, 0), unit: clean(unit),
    modality: resolvedModality, mineral: resolvedMineral, intensity: finite(intensity, finite(value, 0)),
    directionDeg: directionDeg === null ? null : ((finite(directionDeg, 0) % 360) + 360) % 360,
    confidence: normalize01(confidence), source: clean(source, 'GEM import'),
    surveyDate: surveyDate ? String(surveyDate) : null, metadata: Object.freeze({ ...metadata }),
  });
}

export function createSubsurfaceTarget({
  id, observation, score = 0, anomalyScore = 0, depthScore = 0, confidence = 0,
} = {}) {
  if (!observation?.id) throw new TypeError('A source observation is required');
  return Object.freeze({
    id: clean(id, 'gem-subsurface-' + observation.id),
    latitude: observation.latitude, longitude: observation.longitude,
    depthM: observation.depthM, depthTopM: observation.depthTopM, depthBottomM: observation.depthBottomM,
    value: observation.value, unit: observation.unit, modality: observation.modality,
    mineral: observation.mineral, directionDeg: observation.directionDeg,
    score: normalize01(score), anomalyScore: normalize01(anomalyScore),
    depthScore: normalize01(depthScore), confidence: normalize01(confidence),
    source: observation.source, surveyDate: observation.surveyDate,
    metadata: Object.freeze({ ...observation.metadata }),
  });
}
