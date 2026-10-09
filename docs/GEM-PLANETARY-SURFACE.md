# GEM Planetary Surface

## Purpose

The Planet / Global Surface workspace is the navigational foundation of GEM. It uses the application's existing Cesium viewer, its live map-source controller, and the same configured geospatial search stack. It does not create a second globe or a parallel geocoder.

## Current capabilities

- Full-planet overview and fly-to presets for Colombia, South America, Africa, Asia and Dubai.
- Place-name and decimal-degree search through the configured GEM place-search service.
- Live basemap choices from `MapStackController.getStacks()`; unavailable providers are disabled and expose their reason.
- Google Earth Engine dataset selection only while the GEE stack is active. Real tile access still depends on server-side Earth Engine authentication.
- Camera controls for global reset, zoom, north-up, 3D globe and 2D projection.
- Optional atmospheric display, terrain lighting and a geographic graticule.
- Surface-distance measurement between two clicked points, with an on-screen result.
- Cursor coordinates in WGS84 latitude/longitude and camera-altitude readout.
- Source status and map-stack state updates from the existing map controller.

## Event integration

The product shell enters the focused globe through `gem:open-map`, which opens `gem:open-planet-surface`. After the Cesium scene has initialized, `gem:planet-surface-ready` supplies the viewer, map-source controller, geospatial operations and the configured place-search instance. Leaving the focused map emits `gem:close-planet-surface`.

## Data/source boundaries

The basemap control only exposes map stacks registered in GEM and available in the current runtime. It does not label a satellite basemap as geology, mineral alteration or prospectivity evidence. The GEE dropdown selects supported Earth-observation datasets but only returns imagery when the configured gateway is authenticated and available. No geological overlays are invented by this workspace.

## Validation

Unit tests cover coordinate formatting, distance formatting and the availability model used by the basemap picker. The module also uses the existing CI build to catch browser-bundle errors. The live map still needs a manual acceptance pass in Pinokio with the user's actual configured API credentials and network.
