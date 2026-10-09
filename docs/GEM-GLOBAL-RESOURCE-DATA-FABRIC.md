# GEM Global Resource Data Fabric

Version: 1.0.0

## Objective

GEM stores global mineral, metal, petroleum and natural-gas intelligence as provenance-first, depth-resolved records.

The canonical resource record can contain:

- latitude / longitude
- elevation
- top and bottom depth
- depth datum and depth type
- commodity / mineral / metal
- family
- grade and concentration
- thickness
- drillhole / well / sample identifiers
- evidence class
- confidence
- positional and depth accuracy
- source and source version
- observation date
- tags and original payload

## Storage architecture

The operational database is SQLite with:

- WAL
- foreign-key enforcement
- transactional bulk ingestion
- R-tree spatial index
- B-tree indexes for commodity, family, depth, drillhole, well, source and evidence
- source registry
- ingestion batch ledger
- evidence ledger
- observation ledger
- relationship graph
- original payload preservation
- schema versioning

The design intentionally separates the operational index from large remote-sensing/geophysical/raster datasets. Large data products should remain in object/cloud-native storage and be indexed by GEM.

## Ingestion

Server environment:

```bash
GEM_RESOURCE_DB=.gem-data/gem-resources.sqlite
GEM_RESOURCE_INGEST_KEY=<server-secret>
GEM_RESOURCE_MAX_BODY_BYTES=26214400
```

The API handler is exposed by the package as:

```js
import { createGemResourceApiHandler } from 'gem-mineral-intelligence/server/gem-resource-api';
```

Mount it at:

```
/api/gem/resources
```

Endpoints:

- `GET /api/gem/resources`
- `GET /api/gem/resources/snapshot`
- `POST /api/gem/resources/ingest`

Bulk ingestion accepts either:

- `application/json` with an array or `{ "records": [] }`
- `application/x-ndjson` for streaming-oriented batches

Ingestion requires:

```
X-GEM-Ingest-Key: <server-secret>
```

Optional source headers:

```
X-GEM-Source-Id
X-GEM-Source-Name
X-GEM-Source-Version
```

## Data trust model

GEM distinguishes:

- MEASURED
- OBSERVED
- SAMPLED
- DRILLED
- LOGGED
- REMOTE_SENSING
- GEOPHYSICAL_INFERENCE
- GEOLOGICAL_INFERENCE
- MODELLED
- HYPOTHESIS

An inferred record never becomes a resource, reserve, grade, discovery probability or economic valuation merely because it is stored in the database.

## Global scale

For planetary-scale raster and point clouds, GEM should use:

```
GEM operational index
        +
object storage / cloud-native rasters
        +
GeoParquet / Cloud Optimized GeoTIFF / Zarr where appropriate
        +
STAC catalog
        +
GEE planetary processing
        +
3D Tiles for visualization
```

OGC provides interoperable standards for geospatial APIs and data encodings, including GeoPackage, GeoSPARQL, GeoParquet work, STAC and cloud-optimized raster formats. The database therefore stores authoritative metadata and indexes rather than attempting to place every satellite pixel into a relational table.

## Production evolution

The current implementation is a durable local/server adapter. For multi-country production:

1. PostgreSQL + PostGIS becomes the authoritative transactional spatial database.
2. Object storage becomes the immutable data lake.
3. STAC becomes the planetary observation catalog.
4. GeoParquet/Zarr/COG hold bulk analytical datasets.
5. A spatial/semantic knowledge graph connects countries, deposits, mines, companies, wells, refineries, supply chains and evidence.
6. Every ingestion receives a batch ID, source version and provenance record.
7. Immutable audit/event storage preserves the history of changes.
8. Tenant-scoped private datasets remain isolated from public planetary data.

## Core principle

The valuable asset is not merely a map of mineral points.

It is the reproducible chain:

```
SOURCE
  ↓
OBSERVATION
  ↓
LOCATION + DEPTH + TIME
  ↓
EVIDENCE
  ↓
MINERAL SYSTEM
  ↓
TARGET
  ↓
DRILL / VALIDATION
  ↓
ASSET
  ↓
SUPPLY / CAPITAL / SECURITY INTELLIGENCE
```
