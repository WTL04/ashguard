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
CACHE_KEY = "ashguard:latest_fire_data"
CACHE_TTL = 300  # seconds before cache expires
POLL_INTERVAL = 300  # how often the background worker refreshes

redis_client: redis_async.Redis = None

"""
--- Pydantic Type Checking Models ---
"""


class FireDataResponse(BaseModel):
    # GeoJSON FeatureCollection
    satellite_hotspots: dict
    fire_perimeters: dict
    prescribed_fires: dict


class CacheStatusResponse(BaseModel):
    cache_exists: bool
    ttl_seconds_remaining: int
    redis_used_memory: str | None = None
    redis_connected: bool
    error: str | None = None


"""
--- Helper Functions ---
"""

EMPTY_FEATURE_COLLECTION = {"type": "FeatureCollection", "features": []}


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

    # FIX: always return a valid FeatureCollection, never an empty list
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


"""
--- Background Worker ---
"""


async def data_ingestion_worker():
    while True:
        try:
            (
                satellite_hotspots,
                fire_perimeters,
                prescribed_fires,
            ) = await asyncio.gather(
                fetch_satellite_api(state="CA"),
                fetch_fire_perimeters(state="CA"),
                fetch_prescribed_fires(state="CA"),
            )

            # FIX: store as a named dict so FireDataResponse keys match
            payload = json.dumps(
                {
                    "satellite_hotspots": satellite_hotspots,
                    "fire_perimeters": fire_perimeters,
                    "prescribed_fires": prescribed_fires,
                }
            )
            await redis_client.setex(CACHE_KEY, CACHE_TTL, payload)
            logger.info("Cache updated with real API data.")

            await asyncio.sleep(POLL_INTERVAL)

        except asyncio.CancelledError:
            logger.info("Worker shutting down.")
            break

        except Exception as err:
            logger.error(f"Worker error: {err}")
            await asyncio.sleep(10)


"""
--- App Lifespan ---
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    # FIX: validate NASA key at startup so we fail fast, not mid-request
    if not os.getenv("NASA_FIRMS_API_KEY"):
        raise RuntimeError("NASA_FIRMS_API_KEY environment variable is not set")

    global redis_client
    redis_client = redis_async.Redis.from_url(
        REDIS_URL, encoding="utf-8", decode_responses=True
    )

    try:
        await redis_client.ping()
        logger.info("Redis connected successfully.")
    except Exception as e:
        logger.error(f"Redis connection failed: {e}")

    task = asyncio.create_task(data_ingestion_worker())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    await redis_client.aclose()


"""
--- App ---
"""

app = FastAPI(lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.get("/")
def read_root():
    return {"status": "ok", "message": "AshGuard API is running"}


# FIX: response_model wired up so Pydantic validates and docs are accurate
@app.get("/api/v1/fires", response_model=FireDataResponse)
async def get_cached_fires():
    """Returns fire data from Redis cache."""
    raw = await redis_client.get(CACHE_KEY)
    if raw:
        return json.loads(raw)
    # FIX: content must be bytes, and use JSONResponse for consistency
    return JSONResponse(
        status_code=503,
        content={"detail": "Data not yet available, retry shortly"},
    )


# FIX: response_model wired up
@app.get("/api/v1/cache/status", response_model=CacheStatusResponse)
async def cache_status():
    """Shows Redis cache health and TTL remaining."""
    try:
        ttl = await redis_client.ttl(CACHE_KEY)
        exists = await redis_client.exists(CACHE_KEY)
        memory = await redis_client.info("memory")
        return CacheStatusResponse(
            cache_exists=bool(exists),
            ttl_seconds_remaining=ttl,
            redis_used_memory=memory.get("used_memory_human"),
            redis_connected=True,
        )
    except Exception as e:
        return CacheStatusResponse(
            cache_exists=False,
            ttl_seconds_remaining=-1,
            redis_connected=False,
            error=str(e),
        )


# FIX: changed from GET to DELETE — mutating state shouldn't be a GET
@app.delete("/api/v1/cache/flush")
async def flush_cache():
    """Clears the cache — useful for testing."""
    await redis_client.delete(CACHE_KEY)
    return {"message": "Cache cleared"}
