# GEM Planetary Intelligence Architecture

GEM is being engineered as a planetary decision system, not a map.

## Five operating layers

1. **Planetary Data Fabric** — Earth Engine, Sentinel-2, EMIT, EnMAP, geology, geophysics, geochemistry and reference datasets.
2. **Evidence Fabric** — normalized features, provenance, versions, spatial indexing and contradiction handling.
3. **Intelligence Fabric** — Mineral System Knowledge Graph, Global Target Engine, True Multisource Prospectivity, Exploration Optimizer and Drill Intelligence.
4. **Decision Fabric** — Decision Center, Investment Intelligence, portfolio ranking and next-best-action.
5. **Persistent Trust Fabric** — durable target state, provenance, immutable audit trail, model/feature versions, backup and recovery.

## Performance doctrine

GEM must progressively reveal intelligence:

**map → candidates → evidence → decision → investment**

Deep analysis never blocks the first useful result.

Global candidate generation is bounded and spatially indexed. Expensive hyperspectral, geochemical and geological enrichment is applied only to the strongest candidates.

## Storage doctrine

Every production run must be reproducible from:

- run ID
- model version
- feature version
- source versions
- provenance
- target state
- audit event

The current repository includes a durable server-side state-store interface suitable for local development and single-node deployments. Production deployments should replace the filesystem adapter with a transactional spatial database/object-storage implementation without changing the intelligence contracts.

## Backup doctrine

Snapshots and audit logs must be copied to independent storage on a scheduled basis. Recovery must preserve provenance and model versions; restoring data without its lineage is not considered a valid GEM recovery.

## Security doctrine

Secrets and proprietary models remain server-side. Client bundles receive only scoped results. Production APIs require authentication, tenant isolation, rate limiting, signed artifacts and encrypted transport/storage.

## Projection

The target architecture is:

**PLANET → DISCOVER → TARGET → DECIDE → INVEST → DRILL → LEARN**

Every drill/assay result should become new evidence that improves the next target-ranking cycle. This creates a compounding intelligence asset rather than a static GIS product.
