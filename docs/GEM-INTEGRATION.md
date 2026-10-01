# GEM integration

GEM (Geospatial Exploration & Mining) is integrated into God's Eye as an application-owned data layer.

## Runtime flow

1. God's Eye creates the shared application surface. GEM consumes `surface.terrain`, the existing cached terrain-height service.
2. GEM consumes the same Overpass-backed GIS feature source used by God's Eye operations.
3. Hydrology evidence is derived from water-related GIS features returned by the existing feature query.
4. GEM queries the same NASA HLS imagery catalog used by Recent Imagery. Image availability and low-cloud coverage are treated as remote-sensing coverage evidence, not as proof of mineralization.
5. GEM inspects existing God's Eye layers that expose `getAnalystRecords()` and records nearby layer context.
6. Geology is an injected source contract. GEM accepts `getEvidence({ points, center, signal })`, `getFeatures({ points, center, signal })`, or `{ values, source, featureCount }`.
7. The prospectivity engine combines normalized evidence and the `gem-prospectivity` layer renders the resulting targets.

## Shared lifecycle

`gem-prospectivity` is registered in the same application catalog and `LayerLifecycle` as the existing God's Eye layers. It owns one Cesium `CustomDataSource`, clears it on disable, removes it on destroy, and refreshes after camera movement.

## Evidence and confidence

The initial GEM factors are terrain, hydrology, geology, remote sensing, and sampling.
Sampling is intentionally not populated yet.
When a source is unavailable, GEM records that absence explicitly instead of turning missing data into positive evidence.
Target confidence is the fraction of the five evidence channels that are actually backed by a source.

## Geological source

The standalone application now uses the official Servicio Geológico Colombiano (SGC) read-only services by default. GEM combines SGC metallogenic deposits/occurrences with the 2023 geological map as contextual evidence.
A production application can still replace or augment this source by providing `geospatial.geologySource` when creating the standalone application.

Example contract:

~~~js
const geologySource = {
  async getEvidence({ points, center, signal }) {
    // Query an authoritative geological GIS dataset.
    return {
      values: points.map(() => 0.65),
      source: 'Authoritative geology dataset',
      featureCount: 1,
    };
  },
};
~~~

The numeric value in this example is only illustrative; production values must come from the actual dataset.

## Analytical boundary

GEM outputs are heuristic evidence scores. They are not mineral reserves, resources, grades, economic valuations, or proof of a deposit.
Authoritative geological and sampling data should be connected before using GEM for field targeting or economic decisions.
## Default SGC source

The default connector queries the SGC's public ArcGIS services for the Colombian metallogenic map and the 2023 geological map. The metallogenic evidence is commodity-aware and decays with distance from matching deposits/occurrences. Statuses such as producer/past producer, prospect, occurrence/manifestation and anomaly receive different heuristic weights.

These weights are an analytical model implemented by GEM; they are not SGC classifications and should be calibrated against the exploration program and target commodity.
