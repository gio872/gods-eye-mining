/**
 * Global critical-minerals intelligence catalog.
 * Taxonomies are versioned; dynamic market/supply metrics remain provider-sourced.
 */
export const CRITICAL_MINERAL_TAXONOMIES = Object.freeze({
  USGS_2025: Object.freeze([["aluminum","Aluminio","base"],["antimony","Antimonio","technology"],["arsenic","Arsénico","technology"],["barite","Barita","industrial"],["beryllium","Berilio","technology"],["bismuth","Bismuto","technology"],["boron","Boro","industrial"],["cerium","Cerio","rare-earth"],["cesium","Cesio","technology"],["chromium","Cromo","industrial"],["cobalt","Cobalto","battery"],["copper","Cobre","base"],["dysprosium","Disprosio","rare-earth"],["erbium","Erbio","rare-earth"],["europium","Europio","rare-earth"],["fluorspar","Fluorita","industrial"],["gadolinium","Gadolinio","rare-earth"],["gallium","Galio","technology"],["germanium","Germanio","technology"],["graphite","Grafito","battery"],["hafnium","Hafnio","technology"],["holmium","Holmio","rare-earth"],["indium","Indio","technology"],["iridium","Iridio","pgm"],["lanthanum","Lantano","rare-earth"],["lead","Plomo","base"],["lithium","Litio","battery"],["lutetium","Lutecio","rare-earth"],["magnesium","Magnesio","industrial"],["manganese","Manganeso","battery"],["metallurgical-coal","Carbón metalúrgico","industrial"],["neodymium","Neodimio","rare-earth"],["nickel","Níquel","battery"],["niobium","Niobio","industrial"],["palladium","Paladio","pgm"],["phosphate","Fosfato","fertilizer"],["platinum","Platino","pgm"],["potash","Potasa","fertilizer"],["praseodymium","Praseodimio","rare-earth"],["rhenium","Renio","technology"],["rhodium","Rodio","pgm"],["rubidium","Rubidio","technology"],["ruthenium","Rutenio","pgm"],["samarium","Samario","rare-earth"],["scandium","Escandio","technology"],["silicon","Silicio","technology"],["silver","Plata","precious"],["tantalum","Tantalio","technology"],["tellurium","Telurio","technology"],["terbium","Terbio","rare-earth"],["thulium","Tulio","rare-earth"],["tin","Estaño","technology"],["titanium","Titanio","industrial"],["tungsten","Tungsteno","industrial"],["uranium","Uranio","energy"],["vanadium","Vanadio","battery"],["ytterbium","Iterbio","rare-earth"],["yttrium","Itrio","rare-earth"],["zinc","Zinc","base"],["zirconium","Circonio","industrial"]]),
  EU_CRMA_2024: Object.freeze(["antimony","arsenic","bauxite-alumina-aluminium","baryte","beryllium","bismuth","boron","cobalt","coking-coal","copper","feldspar","fluorspar","gallium","germanium","hafnium","helium","heavy-ree","light-ree","lithium","magnesium","manganese","graphite","nickel-battery-grade","niobium","phosphate-rock","phosphorus","platinum-group-metals","scandium","silicon-metal","strontium","tantalum","titanium-metal","tungsten","vanadium"]),
  IEA_2026: Object.freeze([
    'aluminium','cobalt','copper','graphite','lithium','manganese','nickel','rare-earths',
    'gallium','germanium','indium','silicon','tantalum','tungsten','tin','silver','platinum-group-metals',
    'chromium','zinc','vanadium','niobium','tellurium','rhenium','hafnium','beryllium','boron','fluorspar',
    'phosphate','potash','uranium','magnesium','titanium','antimony','arsenic','bismuth','lead','cesium'
  ]),
});

export const EU_STRATEGIC_2024 = Object.freeze(["bauxite-alumina-aluminium","bismuth","boron","cobalt","copper","gallium","germanium","lithium","magnesium","manganese","graphite","nickel-battery-grade","platinum-group-metals","rare-earths-magnets","silicon-metal","titanium-metal","tungsten"]);

export const CRITICAL_MINERAL_CATALOG_VERSION = '2026.10';

const byId = new Map(CRITICAL_MINERAL_TAXONOMIES.USGS_2025.map(([id,name,group]) => [
  id, Object.freeze({ id, name, group })
]));

export function getCriticalMineralRecord(id) {
  const key = String(id ?? '').trim().toLowerCase();
  const base = byId.get(key);
  if (!base) return null;
  return Object.freeze({
    ...base,
    classifications: Object.freeze({
      usgs: 'USGS_2025',
      eu: CRITICAL_MINERAL_TAXONOMIES.EU_CRMA_2024.includes(key) ? 'EU_CRM' : null,
      euStrategic: EU_STRATEGIC_2024.includes(key) || (key === 'neodymium' || key === 'praseodymium' || key === 'dysprosium' || key === 'terbium') ? 'EU_SRM' : null,
      iea: CRITICAL_MINERAL_TAXONOMIES.IEA_2026.includes(key) ? 'IEA_2026' : null,
    }),
    temporal: Object.freeze({
      taxonomyYear: 2025,
      registryVersion: CRITICAL_MINERAL_CATALOG_VERSION,
      dynamicMetrics: 'NOT_CONNECTED',
    }),
  });
}

export function getCriticalMineralCatalog() {
  return CRITICAL_MINERAL_TAXONOMIES.USGS_2025.map(([id]) => getCriticalMineralRecord(id));
}

export function classifyMineral(id) {
  return getCriticalMineralRecord(id)?.classifications ?? null;
}

export function getTaxonomyStats() {
  return Object.freeze({
    usgs2025: CRITICAL_MINERAL_TAXONOMIES.USGS_2025.length,
    euCrma2024: CRITICAL_MINERAL_TAXONOMIES.EU_CRMA_2024.length,
    euStrategic2024: EU_STRATEGIC_2024.length,
    iea2026: CRITICAL_MINERAL_TAXONOMIES.IEA_2026.length,
  });
}
