from fastapi import FastAPI, Response
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from pydantic import BaseModel
import os
import logging
import json
import asyncio
import redis.asyncio as redis_async
from fastapi.middleware.gzip import GZipMiddleware
from dotenv import load_dotenv
from datetime import date
import pandas as pd
from io import StringIO
import httpx

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# each dataset has its own poll interval and ttl (dead man's switch)
CACHE_CONFIGS = {
    "satellite_hotspots": {
        "key": "ashguard:satellite_hotspots",
        "poll": 300,  # 5 mins
        "ttl": 600,  # 10 mins
    },
    "fire_perimeters": {
        "key": "ashguard:fire_perimeters",
        "poll": 600,  # 10 mins
        "ttl": 1200,  # 20 mins
    },
    "prescribed_fires": {
        "key": "ashguard:prescribed_fires",
        "poll": 3600,  # 60 mins
        "ttl": 7200,  # 120 mins
    },
    "shelters": {
        "key": "ashguard:shelters",
        "poll": 600,  # 10 min
        "ttl": 1200,  # 20 mins
    },
}

redis_client: redis_async.Redis = None

"""
--- Pydantic Type Checking Models ---
"""


class GeoDataResponse(BaseModel):
    # GeoJSON FeatureCollection
    satellite_hotspots: dict
    fire_perimeters: dict
    prescribed_fires: dict
    shelters: dict


class CacheStatusResponse(BaseModel):
    datasets: dict
    redis_used_memory: str | None = None
    redis_connected: bool
    error: str | None = None


"""
--- Helper Functions ---
"""

EMPTY_FEATURE_COLLECTION = {"type": "FeatureCollection", "features": []}
EMPTY_FEATURE_COLLECTION_JSON = json.dumps(EMPTY_FEATURE_COLLECTION)


def dicts_to_geojson(data_list: list) -> dict:
    """
    Converts a list of dictionaries into a GeoJSON FeatureCollection.
    """
    features = []

    for entry in data_list:
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [entry["longitude"], entry["latitude"]],
            },
            "properties": {
                "acq_date": entry["acq_date"],
                "acq_time": entry["acq_time"],
                "confidence": entry["confidence"],
                "satellite": entry["satellite"],
            },
        }
        features.append(feature)

    return {"type": "FeatureCollection", "features": features}


"""
--- Asyncronous Background Tasks ---
"""


async def fetch_satellite_api(state: str | None = None) -> dict:
    """
    Returns GeoJSON FeatureCollection of satellite detected hotspots from 3 satellite sources.
    Set state="CA" for California only, otherwise returns global data.
    """
    map_key = os.getenv("NASA_FIRMS_API_KEY")
    if not map_key:
        raise ValueError("NASA_FIRMS_API_KEY environment variable not set")

    cali_bbox = "-124.5,32.5,-114.1,42.1"
    world_bbox = "-180,-90,180,90"
    bbox = cali_bbox if state and state.upper() == "CA" else world_bbox

    if state and state.upper() == "CA":
        logger.info("Fetching California satellite fire data")
    else:
        logger.info("Fetching global satellite fire data")

    day_range = 1
    today = str(date.today())

    satellites = ["VIIRS_NOAA21_NRT", "LANDSAT_NRT", "MODIS_NRT"]
    essential_cols = [
        "latitude",
        "longitude",
        "acq_date",
        "acq_time",
        "confidence",
        "satellite",
    ]

    df_list = []

    async with httpx.AsyncClient(timeout=30.0) as client:
        for satellite in satellites:
            url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{map_key}/{satellite}/{bbox}/{day_range}/{today}"
            r = await client.get(url)

            if r.status_code == 200:
                csv_file_object = StringIO(r.text.strip())
                satellite_df = pd.read_csv(csv_file_object, sep=",")
                satellite_df["satellite"] = satellite
                df_list.append(satellite_df[essential_cols])
                logger.info(f"Successfully fetched data from {satellite}")
            else:
                logger.warning(
                    f"Failed to fetch from {satellite}: status {r.status_code}"
                )

    if not df_list:
        return EMPTY_FEATURE_COLLECTION

    df = pd.concat(df_list, ignore_index=True)
    data = df.to_dict(orient="records")
    return dicts_to_geojson(data)


async def fetch_fire_perimeters(state: str | None = None) -> dict:
    """
    Returns GeoJSON of fire perimeter data from NIFC.
    Set state="CA" for California only, otherwise returns global data.
    """
    params = {
        "where": "1=1",
        "outFields": "*",
        "returnGeometry": "true",
        "f": "geojson",
        "outSR": 4326,
        "resultRecordCount": 2000,
    }

    if state and state.upper() == "CA":
        url = "https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/CA_Perimeters_NIFC_FIRIS_public_view/FeatureServer/0/query"
        logger.info("Fetching California fire perimeters")
    else:
        url = "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query"
        logger.info("Fetching USA fire perimeters")

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        return r.json()


async def fetch_prescribed_fires(state: str | None = None) -> dict:
    """
    Returns GeoJSON of prescribed fires from Watch Duty.
    Set state="CA" for California only, otherwise returns global data.
    """
    params = {
        "where": "1=1",
        "outFields": "*",
        "returnGeometry": "true",
        "f": "geojson",
        "outSR": 4326,
        "resultRecordCount": 2000,
    }

    if state and state.upper() == "CA":
        params["geometry"] = "-124.5,32.5,-114.1,42.0"
        params["geometryType"] = "esriGeometryEnvelope"
        params["spatialRel"] = "esriSpatialRelIntersects"
        logger.info("Fetching California prescribed fires")

    async with httpx.AsyncClient(timeout=30.0) as client:
        url = "https://services5.arcgis.com/VNhSlpl1umSknM3q/arcgis/rest/services/Watch_Duty_Prescribed_Fires/FeatureServer/0/query"
        r = await client.get(url, params=params)
        r.raise_for_status()
        return r.json()


# TEST: Keep this for testing purposes, default to fetch_fire_perimeters()
async def fetch_2026_Year_to_Date_fire_perimeters() -> dict:
    """
    Returns GeoJSON of 2026 Year to Date fire perimeter data from NIFC.
    """
    params = {
        "where": "1=1",
        "outFields": "*",
        "returnGeometry": "true",
        "f": "geojson",
        "outSR": 4326,
        "resultRecordCount": 2000,
    }

    url = "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_YearToDate/FeatureServer/0/query"
    logger.info("Fetching 2026 year to date fire perimeters")

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        return r.json()


async def fetch_shelters() -> dict:
    params = {
        "where": "1=1",
        "outFields": "*",
        "returnGeometry": "true",
        "f": "geojson",
        "outSR": 4326,
        "resultRecordCount": 2000,
    }

    url = "https://services.arcgis.com/pGfbNJoYypmNq86F/arcgis/rest/services/Open_Shelters/FeatureServer/0/query"
    logger.info("Fetching currently available Red Cross shelters")

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        return r.json()


"""
--- Background Workers ---
"""

# Maps each dataset name to its fetch function
FETCH_FUNCTIONS = {
    "satellite_hotspots": lambda: fetch_satellite_api(state="CA"),
    "fire_perimeters": lambda: fetch_fire_perimeters(state="CA"),
    "prescribed_fires": lambda: fetch_prescribed_fires(state="CA"),
    "shelters": fetch_shelters,
}


async def dataset_worker(name: str):
    """
    Independent refresh loop for a single dataset.
    Sleeps for poll interval between fetches.
    TTL acts as a dead man's switch: if this worker dies, Redis
    evicts the key after ttl seconds rather than serving stale data forever.
    """
    config = CACHE_CONFIGS[name]
    key = config["key"]
    poll = config["poll"]
    ttl = config["ttl"]
    fetch_fn = FETCH_FUNCTIONS[name]

    while True:
        try:
            data = await fetch_fn()
            await redis_client.setex(key, ttl, json.dumps(data))
            logger.info(f"[{name}] Cache updated.")
        except asyncio.CancelledError:
            logger.info(f"[{name}] Worker shutting down.")
            break
        except Exception as e:
            logger.error(f"[{name}] Fetch failed: {e}")

        await asyncio.sleep(poll)


"""
--- App Lifespan ---
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    # validate API key
    if not os.getenv("NASA_FIRMS_API_KEY"):
        raise RuntimeError("NASA_FIRMS_API_KEY environment variable is not set")

    # connect to redis
    global redis_client
    redis_client = redis_async.Redis.from_url(
        REDIS_URL, encoding="utf-8", decode_responses=True
    )

    try:
        await redis_client.ping()
        logger.info(f"Redis connected successfully at: {REDIS_URL}.")
    except Exception as e:
        logger.error(f"Redis connection failed: {e}")

    # create background workers tasks for each config in CACHE_CONFIGS
    tasks = [asyncio.create_task(dataset_worker(name)) for name in CACHE_CONFIGS]

    yield

    # cancel all backgorund tasks
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)

    # close redis connection
    await redis_client.aclose()


"""
--- App ---
"""

app = FastAPI(lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.get("/")
def read_root():
    return {"status": "ok", "message": "AshGuard API is running"}


@app.get("/api/v1/geoData")
async def get_cached_data():
    """Returns all geo data from Redis cache. Missing datasets fall back to empty FeatureCollections."""
    parts = []
    missing = []

    for name, config in CACHE_CONFIGS.items():
        raw = await redis_client.get(config["key"])
        if raw:
            parts.append(f'"{name}":{raw}')
        else:
            parts.append(f'"{name}":{EMPTY_FEATURE_COLLECTION_JSON}')
            missing.append(name)

    if missing:
        logger.warning(f"Serving empty collections for: {missing}")

    return Response(
        content="{" + ",".join(parts) + "}",
        media_type="application/json",
    )


@app.get("/api/v1/cache/status", response_model=CacheStatusResponse)
async def cache_status():
    """Shows per-dataset Redis cache health and TTL remaining."""
    try:
        memory = await redis_client.info("memory")
        datasets = {}

        for name, config in CACHE_CONFIGS.items():
            key = config["key"]
            ttl = await redis_client.ttl(key)
            exists = await redis_client.exists(key)
            datasets[name] = {
                "cache_exists": bool(exists),
                "ttl_seconds_remaining": ttl,
            }

        return CacheStatusResponse(
            datasets=datasets,
            redis_used_memory=memory.get("used_memory_human"),
            redis_connected=True,
        )
    except Exception as e:
        return CacheStatusResponse(
            datasets={},
            redis_connected=False,
            error=str(e),
        )


@app.delete("/api/v1/cache/flush")
async def flush_cache():
    """Clears all dataset caches -- useful for testing."""
    keys = [config["key"] for config in CACHE_CONFIGS.values()]
    await redis_client.delete(*keys)
    return {"message": "All caches cleared", "keys_flushed": keys}
