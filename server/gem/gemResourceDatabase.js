import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  createSubsurfaceResourceRecord,
  GEM_SUBSURFACE_RESOURCE_VERSION,
} from '../../src/mineral/subsurfaceResourceIntelligence.js';

export const GEM_RESOURCE_DB_VERSION = '1.0.0';

const SCHEMA_VERSION = 1;

function now() {
  return new Date().toISOString();
}

function json(value) {
  return JSON.stringify(value == null ? null : value);
}

function asObject(value) {
  if (value == null || value === '') return null;
  try { return JSON.parse(value); } catch { return null; }
}

function defaultDbPath() {
  return process.env.GEM_RESOURCE_DB || '.gem-data/gem-resources.sqlite';
}

export function openGemResourceDatabase(filePath = defaultDbPath()) {
  mkdirSync(dirname(filePath), { recursive: true });
  const db = new DatabaseSync(filePath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL;');
  migrateGemResourceDatabase(db);
  return db;
}

export function migrateGemResourceDatabase(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS gem_schema (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS resource_sources (
      source_pk INTEGER PRIMARY KEY,
      source_id TEXT NOT NULL UNIQUE,
      name TEXT,
      publisher TEXT,
      url TEXT,
      version TEXT,
      license TEXT,
      retrieved_at TEXT,
      trust_class TEXT,
      metadata_json TEXT
    );

    CREATE TABLE IF NOT EXISTS ingestion_batches (
      batch_pk INTEGER PRIMARY KEY,
      batch_id TEXT NOT NULL UNIQUE,
      source_id TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT NOT NULL,
      input_count INTEGER NOT NULL DEFAULT 0,
      accepted_count INTEGER NOT NULL DEFAULT 0,
      rejected_count INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      manifest_hash TEXT,
      metadata_json TEXT,
      FOREIGN KEY(source_id) REFERENCES resource_sources(source_id)
    );

    CREATE TABLE IF NOT EXISTS resources (
      resource_pk INTEGER PRIMARY KEY,
      resource_id TEXT NOT NULL UNIQUE,
      family TEXT NOT NULL,
      commodity TEXT NOT NULL,
      commodity_label TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      elevation_m REAL,
      depth_top_m REAL,
      depth_bottom_m REAL,
      depth_midpoint_m REAL,
      depth_thickness_m REAL,
      depth_unit TEXT,
      depth_datum TEXT,
      depth_type TEXT,
      concentration REAL,
      concentration_unit TEXT,
      grade REAL,
      grade_unit TEXT,
      thickness_m REAL,
      evidence_class TEXT NOT NULL,
      confidence REAL NOT NULL,
      positional_accuracy_m REAL,
      depth_accuracy_m REAL,
      drillhole_id TEXT,
      well_id TEXT,
      sample_id TEXT,
      observation_date TEXT,
      status TEXT NOT NULL,
      source_id TEXT,
      ingestion_batch_id TEXT,
      notes TEXT,
      tags_json TEXT,
      original_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(source_id) REFERENCES resource_sources(source_id),
      FOREIGN KEY(ingestion_batch_id) REFERENCES ingestion_batches(batch_id)
    );

    CREATE TABLE IF NOT EXISTS resource_observations (
      observation_pk INTEGER PRIMARY KEY,
      resource_id TEXT NOT NULL,
      observation_id TEXT NOT NULL UNIQUE,
      observed_at TEXT,
      method TEXT,
      value REAL,
      unit TEXT,
      parameter TEXT,
      depth_top_m REAL,
      depth_bottom_m REAL,
      source_id TEXT,
      evidence_class TEXT,
      confidence REAL,
      metadata_json TEXT,
      FOREIGN KEY(resource_id) REFERENCES resources(resource_id) ON DELETE CASCADE,
      FOREIGN KEY(source_id) REFERENCES resource_sources(source_id)
    );

    CREATE TABLE IF NOT EXISTS resource_evidence (
      evidence_pk INTEGER PRIMARY KEY,
      resource_id TEXT NOT NULL,
      evidence_id TEXT NOT NULL UNIQUE,
      evidence_type TEXT NOT NULL,
      evidence_class TEXT NOT NULL,
      uri TEXT,
      content_hash TEXT,
      source_id TEXT,
      collected_at TEXT,
      confidence REAL,
      metadata_json TEXT,
      FOREIGN KEY(resource_id) REFERENCES resources(resource_id) ON DELETE CASCADE,
      FOREIGN KEY(source_id) REFERENCES resource_sources(source_id)
    );

    CREATE TABLE IF NOT EXISTS resource_relationships (
      relationship_pk INTEGER PRIMARY KEY,
      subject_id TEXT NOT NULL,
      predicate TEXT NOT NULL,
      object_id TEXT NOT NULL,
      confidence REAL,
      source_id TEXT,
      metadata_json TEXT,
      UNIQUE(subject_id, predicate, object_id),
      FOREIGN KEY(source_id) REFERENCES resource_sources(source_id)
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS resource_spatial_index USING rtree(
      resource_pk,
      min_lat, max_lat,
      min_lon, max_lon
    );


    CREATE TABLE IF NOT EXISTS geochemical_samples (
      sample_pk INTEGER PRIMARY KEY,
      sample_id TEXT NOT NULL UNIQUE,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      source_id TEXT,
      observed_at TEXT,
      evidence_class TEXT NOT NULL,
      confidence REAL,
      elements_json TEXT NOT NULL,
      original_json TEXT NOT NULL,
      ingestion_batch_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(source_id) REFERENCES resource_sources(source_id),
      FOREIGN KEY(ingestion_batch_id) REFERENCES ingestion_batches(batch_id)
    );

    CREATE TABLE IF NOT EXISTS planetary_observations (
      observation_pk INTEGER PRIMARY KEY,
      observation_id TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL,
      collection TEXT,
      item_id TEXT,
      asset_uri TEXT,
      footprint_json TEXT,
      observed_at TEXT,
      processing_level TEXT,
      metadata_json TEXT,
      source_id TEXT,
      ingestion_batch_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(source_id) REFERENCES resource_sources(source_id),
      FOREIGN KEY(ingestion_batch_id) REFERENCES ingestion_batches(batch_id)
    );

    CREATE TABLE IF NOT EXISTS geology_services (
      service_pk INTEGER PRIMARY KEY,
      service_id TEXT NOT NULL UNIQUE,
      provider TEXT,
      country TEXT,
      service_type TEXT,
      service_url TEXT,
      title TEXT,
      abstract TEXT,
      access_constraints TEXT,
      metadata_json TEXT,
      discovered_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_geochem_location ON geochemical_samples(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_geochem_source ON geochemical_samples(source_id);
    CREATE INDEX IF NOT EXISTS idx_planet_provider ON planetary_observations(provider);
    CREATE INDEX IF NOT EXISTS idx_planet_collection ON planetary_observations(collection);
    CREATE INDEX IF NOT EXISTS idx_geology_country ON geology_services(country);

    CREATE INDEX IF NOT EXISTS idx_resources_commodity ON resources(commodity);
    CREATE INDEX IF NOT EXISTS idx_resources_family ON resources(family);
    CREATE INDEX IF NOT EXISTS idx_resources_depth ON resources(depth_midpoint_m);
    CREATE INDEX IF NOT EXISTS idx_resources_drillhole ON resources(drillhole_id);
    CREATE INDEX IF NOT EXISTS idx_resources_well ON resources(well_id);
    CREATE INDEX IF NOT EXISTS idx_resources_source ON resources(source_id);
    CREATE INDEX IF NOT EXISTS idx_resources_evidence ON resources(evidence_class);
    CREATE INDEX IF NOT EXISTS idx_observations_resource ON resource_observations(resource_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_resource ON resource_evidence(resource_id);
    CREATE INDEX IF NOT EXISTS idx_relationship_subject ON resource_relationships(subject_id);
    CREATE INDEX IF NOT EXISTS idx_relationship_object ON resource_relationships(object_id);
  `);

  const row = db.prepare('SELECT version FROM gem_schema ORDER BY version DESC LIMIT 1').get();
  if (!row) {
    db.prepare('INSERT INTO gem_schema(version, applied_at) VALUES(?, ?)').run(SCHEMA_VERSION, now());
  } else if (Number(row.version) < SCHEMA_VERSION) {
    throw new Error('Unsupported GEM resource database migration state: ' + row.version);
  }
}

export function createResourceSource(db, source = {}) {
  const sourceId = String(source.sourceId || source.id || '').trim();
  if (!sourceId) throw new Error('sourceId is required');
  db.prepare(`
    INSERT INTO resource_sources
      (source_id,name,publisher,url,version,license,retrieved_at,trust_class,metadata_json)
    VALUES (?,?,?,?,?,?,?,?,?)
    ON CONFLICT(source_id) DO UPDATE SET
      name=excluded.name, publisher=excluded.publisher, url=excluded.url,
      version=excluded.version, license=excluded.license,
      retrieved_at=excluded.retrieved_at, trust_class=excluded.trust_class,
      metadata_json=excluded.metadata_json
  `).run(
    sourceId, source.name || null, source.publisher || null, source.url || null,
    source.version || null, source.license || null, source.retrievedAt || null,
    source.trustClass || null, json(source.metadata || null),
  );
  return db.prepare('SELECT * FROM resource_sources WHERE source_id=?').get(sourceId);
}

function upsertSpatialIndex(db, resourcePk, latitude, longitude) {
  db.prepare('DELETE FROM resource_spatial_index WHERE resource_pk=?').run(resourcePk);
  db.prepare(`
    INSERT INTO resource_spatial_index(resource_pk,min_lat,max_lat,min_lon,max_lon)
    VALUES(?,?,?,?,?)
  `).run(resourcePk, latitude, latitude, longitude, longitude);
}

export function upsertSubsurfaceResource(db, input, { batchId = null, source = null } = {}) {
  const record = input?.version === GEM_SUBSURFACE_RESOURCE_VERSION
    ? input
    : createSubsurfaceResourceRecord(input);

  if (source) createResourceSource(db, source);

  const timestamp = now();
  db.prepare(`
    INSERT INTO resources (
      resource_id,family,commodity,commodity_label,latitude,longitude,elevation_m,
      depth_top_m,depth_bottom_m,depth_midpoint_m,depth_thickness_m,depth_unit,
      depth_datum,depth_type,concentration,concentration_unit,grade,grade_unit,
      thickness_m,evidence_class,confidence,positional_accuracy_m,depth_accuracy_m,
      drillhole_id,well_id,sample_id,observation_date,status,source_id,
      ingestion_batch_id,notes,tags_json,original_json,created_at,updated_at
    ) VALUES (
      ?,?,?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?,?,?,?,?, ?,?,?,?,?,?,?,?,?, ?,?,?,?,?
    )
    ON CONFLICT(resource_id) DO UPDATE SET
      family=excluded.family, commodity=excluded.commodity, commodity_label=excluded.commodity_label,
      latitude=excluded.latitude, longitude=excluded.longitude, elevation_m=excluded.elevation_m,
      depth_top_m=excluded.depth_top_m, depth_bottom_m=excluded.depth_bottom_m,
      depth_midpoint_m=excluded.depth_midpoint_m, depth_thickness_m=excluded.depth_thickness_m,
      depth_unit=excluded.depth_unit, depth_datum=excluded.depth_datum, depth_type=excluded.depth_type,
      concentration=excluded.concentration, concentration_unit=excluded.concentration_unit,
      grade=excluded.grade, grade_unit=excluded.grade_unit, thickness_m=excluded.thickness_m,
      evidence_class=excluded.evidence_class, confidence=excluded.confidence,
      positional_accuracy_m=excluded.positional_accuracy_m, depth_accuracy_m=excluded.depth_accuracy_m,
      drillhole_id=excluded.drillhole_id, well_id=excluded.well_id, sample_id=excluded.sample_id,
      observation_date=excluded.observation_date, status=excluded.status, source_id=excluded.source_id,
      ingestion_batch_id=excluded.ingestion_batch_id, notes=excluded.notes,
      tags_json=excluded.tags_json, original_json=excluded.original_json, updated_at=excluded.updated_at
  `).run(
    record.id, record.family, record.commodity, record.commodityLabel,
    record.coordinates.latitude, record.coordinates.longitude, record.elevationM,
    record.depth?.top ?? null, record.depth?.bottom ?? null, record.depth?.midpoint ?? null,
    record.depth?.thickness ?? null, record.depth?.unit ?? null, record.depth?.datum ?? null,
    record.depth?.type ?? null, record.concentration, record.concentrationUnit,
    record.grade, record.gradeUnit, record.thicknessM, record.evidenceClass, record.confidence,
    record.positionalAccuracyM, record.depthAccuracyM, record.drillholeId, record.wellId,
    record.sampleId, record.observationDate, record.status, record.source?.id,
    batchId, record.notes, json(record.tags), json(input), timestamp, timestamp,
  );

  const stored = db.prepare('SELECT * FROM resources WHERE resource_id=?').get(record.id);
  upsertSpatialIndex(db, stored.resource_pk, record.coordinates.latitude, record.coordinates.longitude);
  return stored;
}

export function beginResourceIngestion(db, {
  batchId = 'gem-batch-' + Date.now().toString(36),
  source = null,
  metadata = null,
} = {}) {
  if (source) createResourceSource(db, source);
  db.prepare(`
    INSERT INTO ingestion_batches(batch_id,source_id,started_at,status,metadata_json)
    VALUES(?,?,?,?,?)
  `).run(batchId, source?.sourceId || source?.id || null, now(), 'RUNNING', json(metadata));
  return batchId;
}

export function ingestSubsurfaceResources(db, records = [], options = {}) {
  const batchId = options.batchId || beginResourceIngestion(db, options);
  let accepted = 0;
  let rejected = 0;
  const errors = [];

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const input of records) {
      try {
        upsertSubsurfaceResource(db, input, { batchId, source: options.source || null });
        accepted += 1;
      } catch (error) {
        rejected += 1;
        errors.push({ id: input?.id || null, error: String(error.message || error) });
      }
    }
    db.prepare(`
      UPDATE ingestion_batches
      SET completed_at=?, status=?, input_count=?, accepted_count=?, rejected_count=?, error_count=?
      WHERE batch_id=?
    `).run(now(), rejected ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED', records.length, accepted, rejected, rejected, batchId);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    db.prepare('UPDATE ingestion_batches SET completed_at=?,status=? WHERE batch_id=?')
      .run(now(), 'FAILED', batchId);
    throw error;
  }
  return { batchId, inputCount: records.length, accepted, rejected, errors };
}

export function queryResourceDatabase(db, {
  west = -180, south = -90, east = 180, north = 90,
  commodity = null, family = null, minDepth = null, maxDepth = null,
  evidenceClass = null, minConfidence = 0, limit = 500,
} = {}) {
  const conditions = [
    'r.resource_pk = s.resource_pk',
    's.min_lat <= ?', 's.max_lat >= ?', 's.min_lon <= ?', 's.max_lon >= ?',
    'r.confidence >= ?',
  ];
  const params = [north, south, east, west, Number(minConfidence)];
  if (commodity) { conditions.push('r.commodity=?'); params.push(String(commodity).toLowerCase()); }
  if (family) { conditions.push('r.family=?'); params.push(String(family).toUpperCase()); }
  if (evidenceClass) { conditions.push('r.evidence_class=?'); params.push(String(evidenceClass)); }
  if (minDepth != null) { conditions.push('(r.depth_bottom_m IS NULL OR r.depth_bottom_m >= ?)'); params.push(Number(minDepth)); }
  if (maxDepth != null) { conditions.push('(r.depth_top_m IS NULL OR r.depth_top_m <= ?)'); params.push(Number(maxDepth)); }

  const rows = db.prepare(`
    SELECT r.* FROM resources r
    JOIN resource_spatial_index s ON r.resource_pk=s.resource_pk
    WHERE ${conditions.join(' AND ')}
    ORDER BY r.confidence DESC, r.updated_at DESC
    LIMIT ?
  `).all(...params, Math.max(1, Math.min(10000, Number(limit) || 500)));

  return rows.map((row) => ({
    ...row,
    tags: asObject(row.tags_json),
    original: asObject(row.original_json),
  }));
}

export function getResourceDatabaseSnapshot(db) {
  const count = db.prepare('SELECT COUNT(*) AS count FROM resources').get().count;
  const located = db.prepare('SELECT COUNT(*) AS count FROM resources WHERE latitude IS NOT NULL').get().count;
  const depth = db.prepare('SELECT COUNT(*) AS count FROM resources WHERE depth_midpoint_m IS NOT NULL').get().count;
  const drilled = db.prepare("SELECT COUNT(*) AS count FROM resources WHERE evidence_class='DRILLED'").get().count;
  const sources = db.prepare('SELECT COUNT(*) AS count FROM resource_sources').get().count;
  const batches = db.prepare('SELECT COUNT(*) AS count FROM ingestion_batches').get().count;
  const commodities = db.prepare('SELECT commodity, COUNT(*) AS count FROM resources GROUP BY commodity ORDER BY count DESC').all();
  const geochemicalSamples = db.prepare('SELECT COUNT(*) AS count FROM geochemical_samples').get().count;
  const planetaryObservations = db.prepare('SELECT COUNT(*) AS count FROM planetary_observations').get().count;
  const geologyServices = db.prepare('SELECT COUNT(*) AS count FROM geology_services').get().count;
  return {
    version: GEM_RESOURCE_DB_VERSION,
    schemaVersion: SCHEMA_VERSION,
    resources: Number(count),
    located: Number(located),
    depthResolved: Number(depth),
    drilled: Number(drilled),
    sources: Number(sources),
    ingestionBatches: Number(batches),
    commodities,
    geochemicalSamples: Number(geochemicalSamples),
    planetaryObservations: Number(planetaryObservations),
    geologyServices: Number(geologyServices),
  };
}

export function closeGemResourceDatabase(db) {
  db.close();
}


export function ingestGeochemicalSamples(db, samples = [], { batchId = null, source = null } = {}) {
  if (source) createResourceSource(db, source);
  const timestamp = now();
  let accepted = 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    const stmt = db.prepare(`
      INSERT INTO geochemical_samples
        (sample_id,latitude,longitude,source_id,observed_at,evidence_class,confidence,elements_json,original_json,ingestion_batch_id,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(sample_id) DO UPDATE SET
        latitude=excluded.latitude, longitude=excluded.longitude,
        source_id=excluded.source_id, observed_at=excluded.observed_at,
        evidence_class=excluded.evidence_class, confidence=excluded.confidence,
        elements_json=excluded.elements_json, original_json=excluded.original_json,
        ingestion_batch_id=excluded.ingestion_batch_id, updated_at=excluded.updated_at
    `);
    for (const sample of samples) {
      const sampleId = String(sample.sampleId || sample.id || [
        source?.id || 'source',
        sample.latitude,
        sample.longitude,
        sample.observedAt || ''
      ].join(':'));
      stmt.run(
        sampleId,
        Number(sample.latitude),
        Number(sample.longitude),
        source?.id || sample.sourceId || null,
        sample.observedAt || null,
        sample.evidenceClass || 'OBSERVED',
        Number.isFinite(Number(sample.confidence)) ? Number(sample.confidence) : 70,
        json(sample.elements || {}),
        json(sample),
        batchId,
        timestamp,
        timestamp,
      );
      accepted += 1;
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { accepted };
}

export function ingestPlanetaryObservations(db, observations = [], { batchId = null, source = null } = {}) {
  if (source) createResourceSource(db, source);
  const timestamp = now();
  let accepted = 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    const stmt = db.prepare(`
      INSERT INTO planetary_observations
        (observation_id,provider,collection,item_id,asset_uri,footprint_json,observed_at,processing_level,metadata_json,source_id,ingestion_batch_id,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(observation_id) DO UPDATE SET
        provider=excluded.provider, collection=excluded.collection,
        item_id=excluded.item_id, asset_uri=excluded.asset_uri,
        footprint_json=excluded.footprint_json, observed_at=excluded.observed_at,
        processing_level=excluded.processing_level, metadata_json=excluded.metadata_json,
        source_id=excluded.source_id, ingestion_batch_id=excluded.ingestion_batch_id
    `);
    for (const observation of observations) {
      const itemId = String(observation.itemId || observation.id || '');
      if (!itemId) continue;
      const observationId = [
        observation.provider || source?.id || 'provider',
        observation.collection || '',
        itemId,
      ].join(':');
      stmt.run(
        observationId,
        observation.provider || source?.id || 'unknown',
        observation.collection || null,
        itemId,
        observation.assetUri || null,
        json(observation.footprint || null),
        observation.observedAt || null,
        observation.processingLevel || null,
        json(observation.metadata || observation),
        source?.id || observation.sourceId || null,
        batchId,
        timestamp,
      );
      accepted += 1;
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { accepted };
}

export function ingestGeologyServices(db, services = []) {
  const timestamp = now();
  db.exec('BEGIN IMMEDIATE');
  try {
    const stmt = db.prepare(`
      INSERT INTO geology_services
        (service_id,provider,country,service_type,service_url,title,abstract,access_constraints,metadata_json,discovered_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(service_id) DO UPDATE SET
        provider=excluded.provider, country=excluded.country,
        service_type=excluded.service_type, service_url=excluded.service_url,
        title=excluded.title, abstract=excluded.abstract,
        access_constraints=excluded.access_constraints, metadata_json=excluded.metadata_json,
        discovered_at=excluded.discovered_at
    `);
    for (const service of services) {
      if (!service.serviceId || !service.serviceUrl) continue;
      stmt.run(
        service.serviceId, service.provider || 'OneGeology',
        service.country || null, service.serviceType || null,
        service.serviceUrl, service.title || null, service.abstract || null,
        service.accessConstraints || null, json(service.metadata || service), timestamp,
      );
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { accepted: services.filter((entry) => entry?.serviceId && entry?.serviceUrl).length };
}
