# GEM Global Mineral Intelligence / Target Generation

## Objective

Build a reproducible mineral-intelligence layer above the existing Cesium/GIS application. The system ingests public mineral-reference evidence, normalizes it into a common GeoJSON contract, ranks spatial cells with an auditable deterministic model, and renders target zones directly on the globe.

## Current production modules

### 1. Source registry and ingestion

File: src/mineral/globalMineralSources.js

Responsibilities:

- Register canonical public mineral datasets.
- Keep source identity, endpoint, format, attribution and limitations together.
- Query ArcGIS FeatureServer sources by viewport.
- Use source-specific field contracts to avoid invalid queries.
- Paginate bounded global requests with a stable gid ASC order.
- Normalize source records into a common point-feature contract.

Live public connectors currently include:

- USGS MRDS (mrdata.mrds.mrdsv)
- USGS Global Distribution of Selected Critical Minerals

Discovery-only sources currently registered:

- OneGeology
- World Mining Data
- USGS Mineral Commodity Summaries

Discovery-only means GEM knows the authoritative catalogue exists but does not silently fetch or redistribute third-party data whose service/terms need per-provider validation.

### 2. Reference-data target engine

File: src/mineral/globalTargetEngine.js

The first model is intentionally named GEM-GLOBAL-REFERENCE-01.

The deterministic components are the reference-evidence layer described below; the production discovery pipeline is then enriched by independent geoscience channels.

Every target retains:

- model ID
- rank
- score
- tier
- evidence components
- number of contributing sources
- number of reference records
- nearest documented reference
- commodity tokens
- interpretation text

The score is not a discovery probability. It is a reference-data prospectivity ranking that must be validated with additional geological evidence.

### 3. Multimodal evidence fusion

File: src/mineral/evidenceFusion.js

Evidence channels are defined independently so GEM can progressively add:

- reference evidence
- geology
- geophysics
- geochemistry
- spectral
- structure
- terrain
- hydrology
- environment
- access

Missing data is not converted into zero. Missing channel weights are removed from the denominator, and the model reports evidence coverage and confidence separately.

### 4. Cesium intelligence controller

File: src/mineral/globalMineralIntelligence.js

Responsibilities:

- Determine the current camera bounding box.
- Run current-view or global scans.
- Render documented mineral references on the globe.
- Render ranked target zones.
- Expose the top-target table.
- Fly to a selected target.
- Publish gem:global-intelligence-state.
- Accept gem:run-global-analysis from the existing GEM UI.
- Keep ingestion and visualization lifecycle-safe.

### 5. Attribution and provenance

Every new mineral source is registered in src/data/dataCredits.js and DATA_SOURCES.md.

A target record carries the source IDs used to build it. This allows a future report to explain which datasets contributed to a target.

## Targeting data contract

The canonical internal feature shape is a GeoJSON Feature<Point> with normalized properties:

- sourceId
- sourceName
- recordId
- latitude
- longitude
- name
- status
- mineral
- depositType
- grade
- location
- url
- raw

This contract is source-neutral. A national geological survey, spectral service, drill database or internal sample campaign can be adapted to the same structure without changing the globe renderer.

## Global scan strategy

Viewport scan:

- Uses the current Cesium camera rectangle.
- One bounded page per public ArcGIS source.
- Designed for interactive response.

Global scan:

- Uses the world envelope.
- Requests multiple bounded pages per source.
- Orders by gid ASC so page boundaries are deterministic for a stable snapshot.
- The controller caps the displayed points to keep Cesium responsive.

A future ingestion service can move long-running world acquisition into a server-side job and persist normalized snapshots in object storage/PostGIS without changing the client target API.

## Remaining discovery-engine expansion

1. Hierarchical multiresolution global-to-regional candidate refinement.
2. Authenticated EMIT L2BMIN pixel sampler and mineral-ID / band-depth ingestion.
3. Broader regional geochemical baselines and stream/sediment/soil geochemistry adapters.
4. Structural mapping beyond the magnetic-contrast proxy.
5. Gravity, radiometrics, EM and other independent geophysical channels.
6. Drill-hole collars, assays, alteration logs and interpreted wireframes.
7. Commodity-specific model profiles with deposit-style priors.
8. Statistical calibration against labeled deposits and blind test regions.
9. Persisted dated source snapshots and reproducible model runs.
10. Resource/reserve and economic-context layers kept separate from discovery ranking.

When these channels become available, evidenceResolver can provide target-local normalized scores to the fusion engine; the same target IDs, tiering and provenance contract remain intact.

## True Multisource Mineral Prospectivity / Mineral Discovery Engine

`src/mineral/trueProspectivity.js` remains the single model contract: `GEM-TRUE-MULTISOURCE-01`, now versioned as 2.0.0.

The active evidence channels are:

- **Reference (10%)** — documented mineral occurrences and critical-mineral reference records.
- **Geology (20%)** — GLiM v1.1 lithology compatibility and commodity-specific lithology priors.
- **Geophysics (20%)** — EMAG2v3 anomaly magnitude plus local contrast.
- **Structure (5%)** — deterministic magnetic-contrast derivative; it is derived from the geophysical channel, not an independent sensor.
- **Geochemistry (20%)** — numeric concentrations from the CMMI / Geoscience Australia Critical Minerals in Ores geochemistry service, scored as local robust anomalies against retrieved samples.
- **Spectral (25%)** — a composite of actual Sentinel-2 L2A surface-reflectance COG pixels, EnMAP L2A hyperspectral COG pixels, and EMIT L2BMIN mineral-identification evidence when authenticated Earthdata pixel access is available.

Sentinel-2 and EnMAP are sampled at target-local windows and transformed into deterministic ferric-iron, clay/short-wave-infrared and vegetation/surface-condition proxies. GEM does not treat mere scene coverage as evidence.

EMIT L2BMIN is connected through NASA CMR granule discovery. Pixel-level mineral IDs, band depths, fit and uncertainty are only admitted into the spectral channel when an authenticated `emitSampler` is supplied by the host application; an unauthenticated deployment reports `AUTH_REQUIRED` instead of fabricating a mineral score.

Terrain remains diagnostic context and is deliberately excluded from the prospectivity denominator.

The model is still deterministic rather than statistically calibrated. Its score is a **prospectivity/discovery ranking**, not a probability of discovery, resource/reserve estimate or grade prediction. Evidence coverage, provider status and source provenance are retained on every target so future statistical calibration can be performed without changing the target API.

## Operational safety

Public reference layers are treated as evidence, not as ownership, reserve or economic truth. The client keeps source-specific limitations visible in the source registry and reports evidence coverage alongside target scores.

A global scan is bounded intentionally. It is an interactive reference acquisition mechanism, not a substitute for an ETL snapshot pipeline. A production deployment should persist dated source snapshots, source metadata and model versions before using targets in exploration programs.

## Engineering principle

GEM should distinguish three states:

- Observed/reference evidence: directly sourced records or measurements.
- Derived evidence: deterministic transformations of sourced data.
- Model inference: scores or interpretations produced by GEM.

The user interface must show which state a value belongs to. GEM must never represent a derived/model value as if it were a measured mineral occurrence or a confirmed deposit.

## Engineering status

The True Multisource layer is implemented as a separable evidence pipeline so model calibration can evolve without changing the GIS presentation contract.
