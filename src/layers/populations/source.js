import { PbfReader } from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';
import { createVectorTileSource } from '../../sources/vectorTiles.js';

const PLACE_CLASSES = Object.freeze(['city', 'town', 'village', 'hamlet']);

const CLASS_ZOOM_MIN = Object.freeze({
  city: 4,
  town: 7,
  village: 9,
  hamlet: 11,
});

const CLASS_WEIGHT = Object.freeze({
  city: 1000,
  town: 700,
  village: 450,
  hamlet: 250,
});

const MAX_DECODED_FEATURES_PER_TILE = 20_000;
const DEFAULT_MAX_TILES = 12;
const DEFAULT_MAX_ENTRIES = 96;
const DEFAULT_MAX_CACHE_BYTES = 24 * 1024 * 1024;

/**
 * Pick a vector-tile zoom that increases settlement detail as the camera
 * approaches the ground. Cities remain visible at broad scales, while villages
 * and hamlets appear only when the operator has enough spatial context.
 */
export function populationZoomForCameraHeight(heightM) {
  const height = Number(heightM);
  if (!Number.isFinite(height) || height <= 0) return 10;
  if (height <= 25_000) return 14;
  if (height <= 60_000) return 13;
  if (height <= 140_000) return 12;
  if (height <= 300_000) return 11;
  if (height <= 650_000) return 10;
  if (height <= 1_500_000) return 9;
  if (height <= 3_000_000) return 8;
  if (height <= 6_000_000) return 7;
  if (height <= 12_000_000) return 6;
  if (height <= 25_000_000) return 5;
  return 4;
}

export function populationClassAllowedAtZoom(placeClass, zoom) {
  const klass = String(placeClass || '')
    .trim()
    .toLowerCase();
  const minZoom = CLASS_ZOOM_MIN[klass];
  return (
    PLACE_CLASSES.includes(klass) && Number.isFinite(zoom) && zoom >= minZoom
  );
}

/**
 * Normalize one OpenMapTiles place feature into the compact record consumed by
 * the operator overlay. The source does not invent population counts: rank is
 * the documented importance signal for the place layer.
 */
export function normalizePopulationFeature(feature, { zoom = 12 } = {}) {
  const geometry = feature?.geometry || {};
  if (geometry.type !== 'Point' || !Array.isArray(geometry.coordinates))
    return null;

  const [longitude, latitude] = geometry.coordinates;
  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    Math.abs(longitude) > 180 ||
    Math.abs(latitude) > 90
  )
    return null;

  const properties = feature.properties || {};
  const placeClass = String(properties.class || '')
    .trim()
    .toLowerCase();
  if (!populationClassAllowedAtZoom(placeClass, zoom)) return null;

  const name = String(
    properties.name || properties.name_en || properties.name_de || '',
  ).trim();
  if (!name) return null;

  const rawRank = Number(properties.rank);
  const rank = Number.isFinite(rawRank) ? Math.max(1, rawRank) : 99;
  const capital = String(properties.capital || '').trim();
  const capitalBoost = capital ? 200 : 0;
  const priority =
    CLASS_WEIGHT[placeClass] + capitalBoost + Math.max(0, 100 - rank);

  return {
    id:
      feature.id == null
        ? 'population:' +
          placeClass +
          ':' +
          name +
          ':' +
          latitude.toFixed(5) +
          ':' +
          longitude.toFixed(5)
        : String(feature.id),
    name,
    placeClass,
    rank,
    capital: capital || null,
    latitude,
    longitude,
    priority,
  };
}

/** Decode only the OpenMapTiles place layer from an OpenFreeMap tile. */
export function decodePopulationTile(bytes, z, x, y) {
  const tile = new VectorTile(new PbfReader(bytes));
  const layer = tile.layers?.place;
  if (!layer) return { places: [] };
  if (layer.length > MAX_DECODED_FEATURES_PER_TILE)
    throw new Error('Population tile feature limit exceeded');

  const places = [];
  const seen = new Set();
  for (let i = 0; i < layer.length; i++) {
    const feature = layer.feature(i);
    const geometry = feature.toGeoJSON(x, y, z).geometry;
    const normalized = normalizePopulationFeature(
      { id: feature.id, geometry, properties: feature.properties },
      { zoom: z },
    );
    if (!normalized) continue;

    const key =
      normalized.placeClass +
      '|' +
      normalized.name.toLowerCase() +
      '|' +
      normalized.latitude.toFixed(5) +
      '|' +
      normalized.longitude.toFixed(5);
    if (seen.has(key)) continue;
    seen.add(key);
    places.push(normalized);
  }
  return { places };
}

export function createPopulationSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
  maxTiles = DEFAULT_MAX_TILES,
  maxEntries = DEFAULT_MAX_ENTRIES,
  maxCacheBytes = DEFAULT_MAX_CACHE_BYTES,
  tileJsonUrl = 'https://tiles.openfreemap.org/planet',
  allowedOrigin = 'https://tiles.openfreemap.org',
} = {}) {
  return createVectorTileSource({
    tileJsonUrl,
    allowedOrigin,
    decode: decodePopulationTile,
    fetchImpl,
    maxTiles,
    maxEntries,
    maxCacheBytes,
  });
}

export function mergePopulationTiles(results, maxLabels = 140) {
  const byKey = new Map();
  for (const result of results || []) {
    const tiles = Array.isArray(result?.tiles) ? result.tiles : [result];
    for (const tile of tiles) {
      for (const place of tile?.places || []) {
        const key = place.placeClass + '|' + place.name.toLowerCase() + '|' + place.latitude.toFixed(5) + '|' + place.longitude.toFixed(5);
        const existing = byKey.get(key);
        if (!existing || place.priority > existing.priority) byKey.set(key, place);
      }
    }
  }
  return [...byKey.values()].sort((a, b) => b.priority - a.priority || a.placeClass.localeCompare(b.placeClass) || a.name.localeCompare(b.name)).slice(0, maxLabels);
}
