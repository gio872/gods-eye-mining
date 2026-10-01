# GEM integration

GEM (Geospatial Exploration & Mining) is integrated into God's Eye as an application-owned prospectivity data layer.

## Runtime flow

1. God's Eye creates the shared application surface. GEM consumes `surface.terrain`, the existing terrain-height service.
2. GEM consumes the same GIS feature source used by God's Eye operations and combines it with the official SGC vector/raster services.
3. Hydrology is fused from existing God's Eye GIS features plus the SGC 2023 mapped drainage network.
4. SGC exploration evidence is queried for:
   - 2022 metallogenic deposits and occurrences;
   - mapped geology;
   - faults;
   - geophysical lineaments;
   - alluvial districts;
   - 2023 single and double drainage;
   - 2020 sediment geochemistry for Au, Ag and Cu.
5. GEM selects a current HLS-S30 scene from the Microsoft Planetary Computer STAC catalog and samples Sentinel-2-derived surface reflectance for B02, B04, B8A, B11 and B12. The resulting ferric, ferrous and SWIR-clay proxies are converted into local robust anomalies and vegetation-suppressed remote-sensing evidence.
6. GEM inspects existing God's Eye layers that expose `getAnalystRecords()` and records nearby layer context.
7. The prospectivity engine combines all available evidence into the same weighted score and `gem-prospectivity` renders the cell score plus high-score target markers.

## Prospectivity factors

The score now uses:

`terrain`, `hydrology`, `geology`, `structure`, `mineralization`, `remote-sensing`, `alluvial`, `geochemistry`, `lineaments`, `drainage`, `sampling`.

`remote-sensing` is the spectral-alteration channel. It is populated only when a real HLS sampling source returns spectral measurements.

The geochemistry channel keeps the three pathfinder anomalies separately in target metadata as `auAnomaly`, `agAnomaly` and `cuAnomaly`, while the weighted `geochemistry` factor is a commodity-aware composite:
- gold: Au-dominant, with Ag and Cu as secondary pathfinders;
- silver: Ag-dominant, with Au and Cu as secondary pathfinders;
- copper: Cu-dominant, with Au and Ag as secondary pathfinders.

Anomaly scores are local to the GEM analysis window and use robust median/MAD normalization. This is intentionally different from treating one national concentration threshold as a universal cutoff.

## SGC sources

The default SGC connector is read-only and uses official ArcGIS services for the Colombian geological and metallogenic products. In particular, the 2022 metallogenic service exposes the `LineamientosGeofisicos` layer as polyline geometry, while the 2020 geochemical atlas exposes separate Au, Ag and Cu concentration layers. The 2023 geological atlas exposes mapped drainage layers.

The current connector uses exact point-to-line segment distance for linear features rather than nearest-vertex distance. Drainage “hierarchy” is cartographic: SGC single versus double drainage, permanence coding where present, local mapped-drainage density and proximity. It is not a computed Horton-Strahler stream order.

## Sentinel-2 / HLS spectral model

The spectral source uses HLS-S30 from the Microsoft Planetary Computer. HLS-S30 is the Sentinel-2 member of HLS v2 and is distributed at 30 m with bands including blue (B02), red (B04), narrow NIR (B8A), SWIR1 (B11) and SWIR2 (B12).

GEM computes:
- ferric proxy = B04 / B02;
- ferrous proxy = B11 / B8A;
- SWIR-clay proxy = B11 / B12;
- NDVI = (B8A - B04) / (B8A + B04).

The three alteration proxies are converted to positive local robust anomalies, combined, and down-weighted in strongly vegetated cells. These indices are screening proxies for alteration/exposure patterns; they are not mineral-species identification or laboratory-grade spectroscopy.

The Planetary Computer statistics API is called with a GeoJSON FeatureCollection so a GEM grid can be sampled in one scene request.

## Coverage and confidence

GEM tracks source availability explicitly. The coverage denominator is the ten currently modelled evidence channels: terrain, hydrology, geology, structure, mineralization, remote-sensing, alluvial, geochemistry, lineaments and drainage. Sampling remains reserved for a future field-sample ingestion contract.

When a source is unavailable, the factor is zero and the score receives the coverage multiplier instead of silently treating missing data as evidence.

## Profiles

The default standalone profile is `gold-alluvial`. The core also provides `gold-lode` and `base`. Profiles alter factor weights without changing the underlying observations.

## Analytical boundary

GEM outputs are heuristic prospectivity scores. They are not mineral reserves, mineral resources, assay grades, economic valuations or proof of a deposit. SGC observations are authoritative source data, but the weighting, anomaly normalization and spectral interpretation are GEM analytical assumptions that require calibration against the exploration program, commodity and field validation.
