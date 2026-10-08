/**
 * GEM global mineral search controller utilities.
 * Resolves country geometry from the bundled Natural Earth admin-0 pack and
 * normalizes commodity/metal names into the prospectivity engine's taxonomy.
 */
import { findAdminArea, listCountries, polygonsContain } from '../data/adminBoundaries.js';

export const MINERAL_SEARCH_CATALOG = Object.freeze([
  { key: '', label: 'ALL MINERALS / METALS', aliases: [] },
  { key: 'gold', label: 'Gold / Au', aliases: ['gold', 'au', 'oro'] },
  { key: 'silver', label: 'Silver / Ag', aliases: ['silver', 'ag', 'plata'] },
  { key: 'copper', label: 'Copper / Cu', aliases: ['copper', 'cu', 'cobre'] },
  { key: 'molybdenum', label: 'Molybdenum / Mo', aliases: ['molybdenum', 'mo', 'molibdeno'] },
  { key: 'tungsten', label: 'Tungsten / W / Wolframio', aliases: ['tungsten', 'wolfram', 'wolframium', 'wolframio', 'w'] },
  { key: 'lithium', label: 'Lithium / Li', aliases: ['lithium', 'li', 'litio'] },
  { key: 'nickel', label: 'Nickel / Ni', aliases: ['nickel', 'ni', 'niquel', 'níquel'] },
  { key: 'cobalt', label: 'Cobalt / Co', aliases: ['cobalt', 'co', 'cobalto'] },
  { key: 'platinum', label: 'Platinum / Pt', aliases: ['platinum', 'pt', 'platino'] },
  { key: 'palladium', label: 'Palladium / Pd', aliases: ['palladium', 'pd', 'paladio'] },
  { key: 'iridium', label: 'Iridium / Ir', aliases: ['iridium', 'ir', 'iridio'] },
  { key: 'rhodium', label: 'Rhodium / Rh', aliases: ['rhodium', 'rh', 'rodio'] },
  { key: 'manganese', label: 'Manganese / Mn', aliases: ['manganese', 'mn', 'manganeso'] },
  { key: 'uranium', label: 'Uranium / U', aliases: ['uranium', 'u', 'uranio'] },
  { key: 'phosphate', label: 'Phosphate', aliases: ['phosphate', 'phosphates', 'fosfato'] },
  { key: 'potash', label: 'Potash / K', aliases: ['potash', 'potassium', 'k', 'potasa'] },
  { key: 'rareearth', label: 'Rare Earth Elements / REE', aliases: ['rare earth', 'ree', 'rareearth', 'tierras raras'] },
]);

const CATALOG_BY_KEY = new Map(
  MINERAL_SEARCH_CATALOG.filter((entry) => entry.key).map((entry) => [
    entry.key,
    entry,
  ]),
);

const ALIAS_TO_KEY = new Map();
for (const entry of MINERAL_SEARCH_CATALOG) {
  if (!entry.key) continue;
  for (const alias of [entry.key, ...entry.aliases])
    ALIAS_TO_KEY.set(normalizeSearchText(alias), entry.key);
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export async function listMineralSearchCountries() {
  return listCountries();
}

export function normalizeMineralKey(value) {
  const normalized = normalizeSearchText(value);
  return ALIAS_TO_KEY.get(normalized) || null;
}

export function mineralLabel(key) {
  return CATALOG_BY_KEY.get(key)?.label || 'ALL MINERALS / METALS';
}

function featureSearchText(feature) {
  const p = feature?.properties || {};
  const raw = p.raw && typeof p.raw === 'object' ? p.raw : {};
  return normalizeSearchText(
    [
      p.mineral,
      p.depositType,
      p.name,
      p.location,
      raw.mineral,
      raw.commodity,
      raw.code_list,
      raw.code,
      raw.dep_type,
      raw.deposit_type,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

export function featureMatchesMineral(feature, mineralKey) {
  if (!mineralKey) return true;
  const entry = CATALOG_BY_KEY.get(mineralKey);
  if (!entry) return true;
  const text = featureSearchText(feature);
  return [entry.key, ...entry.aliases]
    .map(normalizeSearchText)
    .filter(Boolean)
    .some((alias) =>
      alias.length <= 2
        ? new RegExp('(?:^| )' + alias + '(?: |$)').test(text)
        : text.includes(alias),
    );
}

export function filterMineralFeatures(features, mineralKey) {
  if (!mineralKey) return Array.isArray(features) ? features : [];
  return (Array.isArray(features) ? features : []).filter((feature) =>
    featureMatchesMineral(feature, mineralKey),
  );
}

export function filterTargetsToCountry(targets, countryArea) {
  if (!countryArea) return Array.isArray(targets) ? targets : [];
  return (Array.isArray(targets) ? targets : []).filter((target) =>
    polygonsContain(
      countryArea.polygons,
      Number(target.latitude),
      Number(target.longitude),
    ),
  );
}

export function attachRequestedCommodity(target, mineralKey) {
  if (!mineralKey) return target;
  return {
    ...target,
    commodities: [mineralKey],
    requestedCommodity: mineralKey,
  };
}

export async function resolveMineralSearch({
  country = '',
  mineral = '',
  near = null,
} = {}) {
  const mineralKey = normalizeMineralKey(mineral) || '';
  const queryCountry = String(country || '').trim();
  let countryArea = null;
  if (queryCountry && queryCountry.toLowerCase() !== 'global')
    countryArea = await findAdminArea(queryCountry, { near });

  if (queryCountry && !countryArea)
    throw new Error('Country not found in the bundled global boundary dataset.');

  const bbox = countryArea
    ? {
        west: Math.max(-180, countryArea.bbox[0]),
        south: Math.max(-85, countryArea.bbox[1]),
        east: Math.min(180, countryArea.bbox[2]),
        north: Math.min(85, countryArea.bbox[3]),
      }
    : { west: -180, south: -85, east: 180, north: 85 };

  return Object.freeze({
    country: countryArea,
    countryName: countryArea?.name || 'GLOBAL',
    mineralKey,
    mineralLabel: mineralLabel(mineralKey),
    bbox,
  });
}
