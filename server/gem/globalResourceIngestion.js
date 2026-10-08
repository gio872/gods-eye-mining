/**
 * GEM Global Resource Ingestion Orchestrator.
 *
 * Unifies existing GEM adapters into the durable Resource Data Fabric.
 * It intentionally ingests metadata/observations separately from inferred
 * prospectivity so source facts remain auditable.
 */

import {
  GLOBAL_MINERAL_SOURCES,
  queryMineralSources,
} from '../../src/mineral/globalMineralSources.js';
import {
  GEOCHEMISTRY_SOURCES,
  queryGeochemistry,
} from '../../src/mineral/geochemistry.js';
import {
  EARTH_OBSERVATION_SOURCES,
} from '../../src/mineral/earthObservationEvidence.js';
import {
  createSubsurfaceResourceRecord,
} from '../../src/mineral/subsurfaceResourceIntelligence.js';
import {
  beginResourceIngestion,
  ingestGeochemicalSamples,
  ingestPlanetaryObservations,
  ingestGeologyServices,
  ingestSubsurfaceResources,
} from './gemResourceDatabase.js';

const ONEGEOLOGY_STATUS_URL =
  'https://onegeology.org/participants/app/1gCountries.cfc?method=viewCountryStatus&servicesOnline=true';

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

function normalizeBbox(bbox) {
  return {
    west: Math.max(-180, Number(bbox?.west ?? -180)),
    south: Math.max(-90, Number(bbox?.south ?? -85)),
    east: Math.min(180, Number(bbox?.east ?? 180)),
    north: Math.min(90, Number(bbox?.north ?? 85)),
  };
}

function arcgisFeatureToResource(feature) {
  const p = feature.properties || {};
  const [longitude, latitude] = feature.geometry?.coordinates || [];
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return null;

  const rawCommodity = p.mineral || p.commodity || p.code_list || p.code || 'unknown';
  const resource = {
    id: [
      p.sourceId || 'usgs',
      p.recordId || p.dep_id || p.gid || p.objectid || p.objectid_1 || '',
    ].join(':'),
    family: 'MINERAL',
    commodity: rawCommodity,
    commodityLabel: rawCommodity,
    latitude: Number(latitude),
    longitude: Number(longitude),
    grade: Number.isFinite(Number(p.grade)) ? Number(p.grade) : null,
    evidenceClass: 'OBSERVED',
    confidence: 70,
    source: {
      id: p.sourceId,
      name: p.sourceName,
      retrievedAt: iso(Date.now()),
      metadata: {
        sourceRecordId: p.recordId,
        depositType: p.depositType,
        status: p.status,
        location: p.location,
        url: p.url,
      },
    },
    tags: ['global-mineral-occurrence', p.sourceId].filter(Boolean),
  };
  try {
    return createSubsurfaceResourceRecord(resource);
  } catch {
    return null;
  }
}

async function discoverOneGeologyServices({ fetchImpl = globalThis.fetch, signal } = {}) {
  const response = await fetchImpl(ONEGEOLOGY_STATUS_URL, {
    signal,
    headers: { Accept: 'text/html,application/xhtml+xml' },
  });
  if (!response.ok) throw new Error('OneGeology HTTP ' + response.status);
  const html = await response.text();

  // The OneGeology status page is a service directory. We preserve the
  // directory evidence rather than pretending every listed organisation has
  // a directly queryable global WFS endpoint.
  const links = [];
  const hrefPattern = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = hrefPattern.exec(html)) !== null) {
    const href = match[1];
    if (/https?:\/\//i.test(href) && /wfs|wms|wcs|geolog|geosc/i.test(href)) {
      links.push(href);
    }
  }

  return [...new Set(links)].map((serviceUrl, index) => ({
    serviceId: 'onegeology-discovered-' + index + '-' + Buffer.from(serviceUrl).toString('base64url').slice(0, 32),
    provider: 'OneGeology',
    serviceType: /wfs/i.test(serviceUrl)
      ? 'WFS'
      : /wcs/i.test(serviceUrl)
        ? 'WCS'
        : 'WMS',
    serviceUrl,
    title: 'OneGeology discovered service',
    metadata: {
      directory: ONEGEOLOGY_STATUS_URL,
      discoveredAt: iso(Date.now()),
    },
  }));
}

async function searchStacWindow(source, bbox, {
  fetchImpl = globalThis.fetch,
  signal,
  limit = 20,
} = {}) {
  const url = new URL(source.stac + '/search');
  url.searchParams.set('collections', source.collection);
  url.searchParams.set('bbox', [
    bbox.west, bbox.south, bbox.east, bbox.north,
  ].join(','));
  url.searchParams.set('limit', String(Math.min(100, Math.max(1, limit))));
  const response = await fetchImpl(url, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(source.name + ' HTTP ' + response.status);
  const payload = await response.json();
  return Array.isArray(payload.features) ? payload.features : [];
}

async function discoverEmitGranules(bbox, {
  fetchImpl = globalThis.fetch,
  signal,
  limit = 20,
} = {}) {
  const source = EARTH_OBSERVATION_SOURCES.emit;
  const url = new URL(source.cmr);
  url.searchParams.set('short_name', source.shortName);
  url.searchParams.set('version', source.version);
  url.searchParams.set('bounding_box', [
    bbox.west, bbox.south, bbox.east, bbox.north,
  ].join(','));
  url.searchParams.set('page_size', String(Math.min(200, Math.max(1, limit))));
  url.searchParams.set('format', 'json');

  const response = await fetchImpl(url, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('EMIT CMR HTTP ' + response.status);
  const payload = await response.json();
  return Array.isArray(payload.feed?.entry) ? payload.feed.entry : [];
}

function stacToObservation(source, item) {
  const props = item.properties || {};
  const assets = item.assets || {};
  const firstAsset = Object.values(assets).find((asset) => asset?.href);
  return {
    provider: source.id,
    collection: source.collection,
    itemId: item.id,
    assetUri: firstAsset?.href || null,
    footprint: item.geometry || null,
    observedAt: props.datetime || props['start_datetime'] || null,
    processingLevel: props.processing_level || props['processing:level'] || null,
    metadata: {
      bbox: item.bbox || null,
      properties: props,
      assetCount: Object.keys(assets).length,
    },
  };
}

function emitToObservation(granule) {
  const umm = granule.umm || {};
  return {
    provider: EARTH_OBSERVATION_SOURCES.emit.id,
    collection: EARTH_OBSERVATION_SOURCES.emit.shortName,
    itemId: granule.id || granule.title,
    assetUri: null,
    footprint: granule.browseAndAccessInformation?.[0]?.getData?.[0]?.onlineAccessUrl || null,
    observedAt: granule.timeStart || granule.timeEnd || null,
    processingLevel: 'L2BMIN',
    metadata: granule,
  };
}

/**
 * Ingest public/global source evidence for a bounding box.
 *
 * The function is safe to run repeatedly: resource IDs, observations and
 * source IDs are upserted by the database layer.
 */
export async function ingestGlobalResourceSources(db, {
  bbox = { west: -180, south: -85, east: 180, north: 85 },
  signal,
  fetchImpl = globalThis.fetch,
  maxPages = 1,
  stacLimit = 20,
  emitLimit = 20,
  includeOneGeology = true,
} = {}) {
  const box = normalizeBbox(bbox);
  const runId = 'gem-global-ingest-' + Date.now().toString(36);
  const startedAt = Date.now();

  const results = {
    runId,
    bbox: box,
    sources: {},
    startedAt: new Date(startedAt).toISOString(),
  };

  const sourceManifest = [
    GLOBAL_MINERAL_SOURCES.mrds,
    GLOBAL_MINERAL_SOURCES.criticalMinerals,
    GEOCHEMISTRY_SOURCES.cmio,
    EARTH_OBSERVATION_SOURCES.sentinel2,
    EARTH_OBSERVATION_SOURCES.enmap,
    EARTH_OBSERVATION_SOURCES.emit,
    {
      id: 'google-earth-engine',
      name: 'Google Earth Engine',
      type: 'planetary-processing',
      datasets: [
        'COPERNICUS/S2_SR_HARMONIZED',
        'LANDSAT/LC09/C02/T1_L2',
        'COPERNICUS/S1_GRD',
        'COPERNICUS/DEM/GLO-30',
        'ESA/WorldCover/v200',
        'HLS/HLSL30/v002',
      ],
    },
  ];

  // Persist source manifest even when an individual network provider is down.
  for (const source of sourceManifest) {
    if (!source?.id) continue;
    try {
      const { createResourceSource } = await import('./gemResourceDatabase.js');
      createResourceSource(db, {
        id: source.id,
        name: source.name,
        url: source.endpoint || source.stac || source.cmr || source.portal || null,
        version: source.version || null,
        metadata: source,
      });
    } catch {
      // Source registration failure is reported through provider result.
    }
  }

  const mineralBatch = beginResourceIngestion(db, {
    batchId: runId + '-minerals',
    source: { id: 'gem-global-mineral-ingestion', name: 'GEM Global Mineral Ingestion' },
    metadata: { bbox: box, sources: ['usgs-mrds', 'usgs-critical-minerals'] },
  });

  const mineralResults = await queryMineralSources(box, {
    fetchImpl,
    signal,
    maxPages,
  });

  let acceptedMinerals = 0;
  for (const result of mineralResults) {
    const resources = result.features
      .map(arcgisFeatureToResource)
      .filter(Boolean)
      .map((record) => ({
        ...record,
        source: {
          ...(record.source || {}),
          id: result.source.id,
          name: result.source.name,
        },
      }));

    if (resources.length) {
      const ingested = ingestSubsurfaceResources(db, resources, {
        batchId: mineralBatch,
        source: {
          id: result.source.id,
          name: result.source.name,
          url: result.source.endpoint,
        },
      });
      acceptedMinerals += ingested.accepted;
    }

    results.sources[result.source.id] = {
      type: result.source.type,
      ok: result.ok,
      discovered: result.count,
      accepted: resources.length,
      durationMs: result.durationMs,
      error: result.error?.message || null,
    };
  }

  const geochem = await queryGeochemistry(
    {
      latitude: (box.south + box.north) / 2,
      longitude: (box.west + box.east) / 2,
    },
    {
      fetchImpl,
      signal,
      radiusDegrees: Math.min(10, Math.max(0.1, (box.north - box.south) / 2)),
      maxFeatures: 1000,
    },
  );

  const geochemBatch = beginResourceIngestion(db, {
    batchId: runId + '-geochemistry',
    source: { id: GEOCHEMISTRY_SOURCES.cmio.id, name: GEOCHEMISTRY_SOURCES.cmio.name },
    metadata: { bbox: box },
  });

  const geochemResult = geochem.ok
    ? ingestGeochemicalSamples(db, geochem.samples, {
        batchId: geochemBatch,
        source: { id: geochem.sourceId, name: geochem.sourceName, url: GEOCHEMISTRY_SOURCES.cmio.endpoint },
      })
    : { accepted: 0 };

  results.sources[GEOCHEMISTRY_SOURCES.cmio.id] = {
    ok: geochem.ok,
    discovered: geochem.samples.length,
    accepted: geochemResult.accepted,
    error: geochem.error?.message || null,
  };

  const planetaryBatch = beginResourceIngestion(db, {
    batchId: runId + '-planetary',
    source: { id: 'gem-planetary-ingestion', name: 'GEM Planetary Observation Ingestion' },
    metadata: { bbox: box },
  });

  for (const source of [EARTH_OBSERVATION_SOURCES.sentinel2, EARTH_OBSERVATION_SOURCES.enmap]) {
    try {
      const items = await searchStacWindow(source, box, { fetchImpl, signal, limit: stacLimit });
      const observations = items.map((item) => stacToObservation(source, item));
      const accepted = ingestPlanetaryObservations(db, observations, {
        batchId: planetaryBatch,
        source: {
          id: source.id,
          name: source.name,
          url: source.stac,
          version: source.collection,
        },
      });
      results.sources[source.id] = { ok: true, discovered: items.length, accepted: accepted.accepted };
    } catch (error) {
      results.sources[source.id] = { ok: false, discovered: 0, accepted: 0, error: error.message };
    }
  }

  try {
    const granules = await discoverEmitGranules(box, { fetchImpl, signal, limit: emitLimit });
    const observations = granules.map(emitToObservation);
    const accepted = ingestPlanetaryObservations(db, observations, {
      batchId: planetaryBatch,
      source: {
        id: EARTH_OBSERVATION_SOURCES.emit.id,
        name: EARTH_OBSERVATION_SOURCES.emit.name,
        url: EARTH_OBSERVATION_SOURCES.emit.cmr,
        version: EARTH_OBSERVATION_SOURCES.emit.version,
      },
    });
    results.sources[EARTH_OBSERVATION_SOURCES.emit.id] = {
      ok: true,
      discovered: granules.length,
      accepted: accepted.accepted,
      status: granules.length ? 'GRANULES_DISCOVERED_AUTH_REQUIRED_FOR_PIXEL_DATA' : 'NO_COVERAGE',
    };
  } catch (error) {
    results.sources[EARTH_OBSERVATION_SOURCES.emit.id] = {
      ok: false, discovered: 0, accepted: 0, error: error.message,
    };
  }

  if (includeOneGeology) {
    try {
      const services = await discoverOneGeologyServices({ fetchImpl, signal });
      const discovered = ingestGeologyServices(db, services);
      results.sources.onegeology = {
        ok: true,
        discovered: services.length,
        accepted: discovered.accepted,
        directory: ONEGEOLOGY_STATUS_URL,
      };
    } catch (error) {
      results.sources.onegeology = {
        ok: false, discovered: 0, accepted: 0, error: error.message,
      };
    }
  }

  results.summary = {
    mineralRecordsAccepted: acceptedMinerals,
    providerCount: Object.keys(results.sources).length,
    durationMs: Date.now() - startedAt,
  };

  return results;
}
