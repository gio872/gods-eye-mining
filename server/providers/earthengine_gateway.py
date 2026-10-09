#!/usr/bin/env python3
"""GEM Google Earth Engine local gateway.

Uses the official Earth Engine Python API server-side. No credentials are
stored in the repository. Configure GEM_EARTHENGINE_PROJECT and authenticate
with the Earth Engine CLI or application-default credentials on the host.
"""

import json
import os
import traceback
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

try:
    import ee
except ImportError:
    ee = None

DATASETS = {
    "sentinel2": "COPERNICUS/S2_SR_HARMONIZED",
    "landsat": "LANDSAT/LC09/C02/T1_L2",
    "sentinel1": "COPERNICUS/S1_GRD",
    "elevation": "COPERNICUS/DEM/GLO-30",
    "worldcover": "ESA/WorldCover/v200",
    "hls": "HLS/HLSL30/v002",
}

_initialized = False


def initialize_ee():
    global _initialized
    if _initialized:
        return
    if ee is None:
        raise RuntimeError(
            "earthengine-api is not installed; install it with "
            "'python -m pip install earthengine-api'"
        )
    project = os.environ.get("GEM_EARTHENGINE_PROJECT", "").strip()
    if not project:
        raise RuntimeError("GEM_EARTHENGINE_PROJECT is required")
    service_account = os.environ.get('GEM_EARTHENGINE_SERVICE_ACCOUNT', '').strip()
    private_key = os.environ.get('GEM_EARTHENGINE_PRIVATE_KEY', '').strip()
    if service_account and private_key:
        credentials = ee.ServiceAccountCredentials(service_account, key_data=private_key)
        ee.Initialize(credentials=credentials, project=project)
    else:
        ee.Initialize(project=project)
    _initialized = True


def resolve_dataset(value):
    text = str(value or "").strip()
    dataset = DATASETS.get(text.lower(), text)
    if not dataset:
        return DATASETS['sentinel2']
    if dataset not in DATASETS.values():
        raise ValueError('Unsupported Earth Engine dataset')
    return dataset


def collection(dataset, payload):
    image_collection = ee.ImageCollection(dataset)
    if payload.get("startDate"):
        image_collection = image_collection.filterDate(
            payload["startDate"],
            payload.get("endDate") or (datetime.fromisoformat(str(payload["startDate"]).replace('Z', '+00:00')) + timedelta(days=1)).isoformat(),
        )
    if payload.get("region"):
        image_collection = image_collection.filterBounds(
            ee.Geometry(payload["region"])
        )
    return image_collection


def build_image(dataset, payload):
    if dataset == DATASETS["sentinel2"]:
        ic = collection(dataset, payload).filter(
            ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 35)
        )
        return ic.median().select(["B4", "B3", "B2"])
    if dataset == DATASETS["hls"]:
        return collection(dataset, payload).median().select(
            ["B4", "B3", "B2"]
        )
    if dataset == DATASETS["landsat"]:
        return collection(dataset, payload).median().select(
            ["SR_B4", "SR_B3", "SR_B2"]
        )
    if dataset == DATASETS["sentinel1"]:
        return collection(dataset, payload).median().select(["VV"])
    if dataset == DATASETS["elevation"]:
        return ee.Image(dataset).select(["DEM"])
    if dataset == DATASETS["worldcover"]:
        return ee.Image(dataset).select(["Map"])
    return ee.Image(dataset)


def default_visualization(dataset):
    if dataset == DATASETS["sentinel1"]:
        return {"bands": ["VV"], "min": -25, "max": 0}
    if dataset == DATASETS["elevation"]:
        return {"bands": ["DEM"], "min": 0, "max": 2500}
    if dataset == DATASETS["worldcover"]:
        return {"bands": ["Map"], "min": 10, "max": 100}
    if dataset == DATASETS["landsat"]:
        return {
            "bands": ["SR_B4", "SR_B3", "SR_B2"],
            "min": 7000,
            "max": 18000,
        }
    return {"bands": ["B4", "B3", "B2"], "min": 0, "max": 3000}


def get_map(payload):
    initialize_ee()
    dataset = resolve_dataset(payload.get("dataset"))
    image = build_image(dataset, payload)
    vis = dict(default_visualization(dataset))
    vis.update(payload.get("visualization") or {})
    info = image.getMapId(vis)
    tile_fetcher = info.get("tile_fetcher")
    if tile_fetcher is None:
        raise RuntimeError("Earth Engine returned no tile fetcher")
    return {
        "ok": True,
        "dataset": dataset,
        "mapid": info.get("mapid"),
        "token": info.get("token"),
        "urlTemplate": tile_fetcher.url_format,
        "attribution": (
            "Google Earth Engine / public Earth observation datasets"
        ),
    }


class Handler(BaseHTTPRequestHandler):
    def _send(self, status, payload):
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):
        if urlparse(self.path).path != "/api/gee/health":
            self._send(404, {"error": "not found"})
            return
        try:
            initialize_ee()
            self._send(200, {"ok": True, "provider": "earth-engine"})
        except Exception as exc:
            self._send(503, {"ok": False, "provider": "earth-engine", "error": str(exc)})

    def do_POST(self):
        if urlparse(self.path).path != "/api/gee/map":
            self._send(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            self._send(200, get_map(payload))
        except Exception as exc:
            traceback.print_exc()
            self._send(503, {"ok": False, "error": str(exc)})


def main():
    port = int(os.environ.get("GEM_EARTHENGINE_GATEWAY_PORT", "8765"))
    server = HTTPServer(("127.0.0.1", port), Handler)
    print(f"GEM Earth Engine gateway listening on 127.0.0.1:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
