# GEM — Global Exploration & Mineral Intelligence

GEM is a planetary-scale mineral intelligence system for geological exploration.

It is no longer organized around a generic situational-awareness / “God's Eye View” product. Cesium is used as the 3D geospatial visualization engine; **GEM is the application, intelligence layer, and product identity**.

## Core intelligence pipeline

`planetary data → evidence fusion → mineral system → target → next-best action → drill hypothesis → assay feedback`

### Intelligence modules

- Planetary Data Fabric
- Global Mineral Intelligence System
- Global Target Engine
- True Multisource Prospectivity
- Mineral Discovery Engine
- Mineral Systems Knowledge Graph
- Hierarchical Target Engine
- Exploration Optimizer
- Drill Intelligence
- Geology / Geophysics / Geochemistry
- Sentinel-2 / EnMAP / EMIT spectral evidence
- Earth Engine server-side raster processing
- Provenance and uncertainty tracking

## GEM principles

GEM distinguishes:

1. observed/reference evidence;
2. derived features;
3. model inference;
4. exploration decisions.

Missing evidence is not treated as zero. Scores are prospectivity rankings unless explicitly calibrated; GEM does not infer reserves, resources, grades or economic value without the required evidence and models.

## Interface

The application starts as **GEM Mineral Intelligence System** with a global 3D Earth view and the mineral-intelligence command center. The target workflow is centered on mineral sources, evidence convergence, target ranking, exploration planning and drill intelligence.

## Security

Production credentials, private datasets, commercial data, private model weights and proprietary scoring logic must remain server-side/private. Never place Earth Engine service credentials, OAuth refresh tokens, provider secrets or private model artifacts in the browser bundle.

See [SECURITY-ARCHITECTURE.md](SECURITY-ARCHITECTURE.md) and [SECURITY.md](SECURITY.md).

## Development

Requires Node.js 24.x or 26.x.

```bash
npm ci
npm test
npm run dev
```

The repository is currently being migrated from its original visualization foundation into the canonical GEM platform. Legacy Cesium, camera, scene and data modules are retained where they provide reusable geospatial infrastructure; legacy product branding is being removed from the GEM application surface.

## Current implementation

The `feature/global-mineral-intelligence` branch contains the active GEM intelligence work, including the Mineral Discovery Engine, Knowledge Graph, Hierarchical Target Engine, Exploration Optimizer and Drill Intelligence.

## License and third-party components

Existing third-party notices and licensing information remain in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [LICENSE](LICENSE).
