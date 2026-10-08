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

The deterministic components are:
- occurrence density
- commodity diversity
- critical-mineral evidence
- development evidence
- multi-source convergence

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

## Next evidence expansion

1. Geological compatibility surfaces.
2. Structural/fault and lineament evidence.
3. Magnetics, gravity, radiometrics and EM.
4. Hyperspectral alteration/mineral indices.
5. Geochemistry and pathfinder-element anomalies.
6. DEM-derived terrain variables.
7. Hydrology and environmental exclusions.
8. Drill-hole collars, assays and interpreted wireframes.
9. Commodity/model-specific priors.
10. Resource/reserve and economic-context layers.

When these channels become available, evidenceResolver can provide target-local normalized scores to the fusion engine; the same target IDs, tiering and provenance contract remain intact.


## True Multisource Mineral Prospectivity

`src/mineral/trueProspectivity.js` is the calibrated evidence-fusion layer.

Current active prospectivity channels:
- Reference mineral occurrences: documented mineral evidence already present in public datasets.
- Geology: GLiM v1.1 lithology sampled at each target coordinate and scored against commodity/deposit-style lithology priors.
- Geophysics: EMAG2v3 magnetic anomaly sampled at the target and a local 3x3 neighborhood.
- Structure: a deterministic local magnetic-contrast derivative; it is explicitly marked as derived evidence, not an independent sensor.

Current fusion weights are reference 20%, geology 35%, geophysics 30% and structure 15%. Missing channels reduce evidence coverage rather than becoming zero-valued evidence.

Terrain is sampled and retained as diagnostic context, but is not currently assigned prospectivity weight. Spectral evidence is reserved for actual per-pixel mineral-identification/abundance values from sensors such as EMIT; merely having an image over the target is not treated as mineral evidence.

## Operational safety

Public reference layers are treated as evidence, not as ownership, reserve or economic truth. The client keeps source-specific limitations visible in the source registry and reports evidence coverage alongside target scores.

A global scan is bounded intentionally. It is an interactive reference acquisition mechanism, not a substitute for an ETL snapshot pipeline. A production deployment should persist dated source snapshots, source metadata and model versions before using targets in exploration programs.

## Engineering principle

GEM should distinguish three states:
- Observed/reference evidence: directly sourced records or measurements.
- Derived evidence: deterministic transformations of sourced data.
- Model inference: scores or interpretations produced by GEM.

The user interface must show which state a value belongs to. GEM must never represent a derived/model value as if it were a measured mineral occurrence or a confirmed deposit.