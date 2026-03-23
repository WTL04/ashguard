### TESTING FASTAPI SERVER AND REDIS CACHING ON EC2 INSTANCE

from fastapi import FastAPI, Response
from contextlib import asynccontextmanager
import os
import logging
import json
import asyncio
import redis.asyncio as redis_async
from fastapi.middleware.gzip import GZipMiddleware
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
CACHE_KEY = "ashguard:latest_fire_data"
CACHE_TTL = 120       # seconds before cache expires
POLL_INTERVAL = 30    # how often the background worker refreshes

redis_client: redis_async.Redis = None


"""
--- Sample Data (replaces real API calls for testing) ---
"""

SAMPLE_FIRE_DATA = [
    # [0] Satellite hotspots GeoJSON
    {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [-118.2437, 34.0522]},
                "properties": {
                    "acq_date": "2026-03-19",
                    "acq_time": "0130",
                    "confidence": "high",
                    "satellite": "VIIRS_NOAA21_NRT",
                },
            },
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [-119.4960, 37.7749]},
                "properties": {
                    "acq_date": "2026-03-19",
                    "acq_time": "0145",
                    "confidence": "nominal",
                    "satellite": "MODIS_NRT",
                },
            },
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [-116.5453, 33.8303]},
                "properties": {
                    "acq_date": "2026-03-19",
                    "acq_time": "0200",
                    "confidence": "low",
                    "satellite": "LANDSAT_NRT",
                },
            },
        ],
    },
    # [1] Fire perimeters GeoJSON
    {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [-118.50, 34.20],
                            [-118.45, 34.20],
                            [-118.45, 34.25],
                            [-118.50, 34.25],
                            [-118.50, 34.20],
                        ]
                    ],
                },
                "properties": {
                    "IncidentName": "Sample Fire Alpha",
                    "GISAcres": 1200,
                    "PercentContained": 45,
                },
            },
        ],
    },
    # [2] Prescribed fires GeoJSON
    {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [-120.10, 38.50],
                            [-120.05, 38.50],
                            [-120.05, 38.55],
                            [-120.10, 38.55],
                            [-120.10, 38.50],
                        ]
                    ],
                },
                "properties": {
                    "PrescribedFireName": "Sample Prescribed Burn",
                    "Agency": "USFS",
                    "PlannedAcres": 300,
                },
            },
        ],
    },
]


"""
--- Background Worker ---
"""


async def data_ingestion_worker():
    while True:
        try:
            # using sample data instead of real API calls for now
            payload = json.dumps(SAMPLE_FIRE_DATA)
            await redis_client.setex(CACHE_KEY, CACHE_TTL, payload)
            logger.info("Cache updated with sample data.")
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
    global redis_client
    redis_client = redis_async.Redis.from_url(
        REDIS_URL, encoding="utf-8", decode_responses=True
    )

    # verify redis connection on startup
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


@app.get("/api/v1/fires")
async def get_cached_fires():
    """Returns fire data from Redis cache."""
    raw = await redis_client.get(CACHE_KEY)
    if raw:
        return json.loads(raw)
    return Response(
        status_code=503,
        content="Data not yet available, retry shortly",
    )


@app.get("/api/v1/cache/status")
async def cache_status():
    """Shows Redis cache health and TTL remaining."""
    try:
        ttl = await redis_client.ttl(CACHE_KEY)
        exists = await redis_client.exists(CACHE_KEY)
        memory = await redis_client.info("memory")
        return {
            "cache_exists": bool(exists),
            "ttl_seconds_remaining": ttl,
            "redis_used_memory": memory.get("used_memory_human"),
            "redis_connected": True,
        }
    except Exception as e:
        return {"redis_connected": False, "error": str(e)}


@app.get("/api/v1/cache/flush")
async def flush_cache():
    """Clears the cache — useful for testing."""
    await redis_client.delete(CACHE_KEY)
    return {"message": "Cache cleared"}



### ORIGINAL
# from fastapi import FastAPI, Response
# import pandas as pd
# from contextlib import asynccontextmanager
# from io import StringIO
# import os
# import logging
# from dotenv import load_dotenv
# from datetime import date
# import json
# import asyncio  # for schedualed worker
# import httpx  # for requests
# from fastapi.middleware.gzip import GZipMiddleware  # for data compression

# load_dotenv()

# # logs success/failed api calls
# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# # local dictionary cache
# app_cache = {}


# """
# --- Helper Functions ---
# """


# def dicts_to_geojson(data_list: list) -> dict:
#     """
#     Converts a list of dictionaries into GeoJSON.
#     """
#     features = []

#     for entry in data_list:
#         feature = {
#             "type": "Feature",
#             "geometry": {
#                 "type": "Point",
#                 "coordinates": [entry["longitude"], entry["latitude"]],
#             },
#             "properties": {
#                 "acq_date": entry["acq_date"],
#                 "acq_time": entry["acq_time"],
#                 "confidence": entry["confidence"],
#                 "satellite": entry["satellite"],
#             },
#         }
#         features.append(feature)

#     return {"type": "FeatureCollection", "features": features}


# """
# --- Asyncronous Background Tasks ---
# """


# async def fetch_satellite_api(state: str | None = None):
#     """
#     Returns discionary of satellite detected hotspots from 3 satellite sources
#     Set state="CA" for California only, otherwise returns global data
#     """

#     # get your map key here https://firms.modaps.eosdis.nasa.gov/api/area/html
#     # or ask will for his
#     # export NASA_FIRMS_API_KEY="your map key"
#     map_key = os.getenv("NASA_FIRMS_API_KEY")
#     if not map_key:
#         raise ValueError("NASA_FIRMS_API_KEY environment variable not set")

#     # API variables
#     cali_bbox = "-124.5,32.5,-114.1,42.1"
#     world_bbox = "-180,-90,180,90"
#     bbox = cali_bbox if state and state.upper() == "CA" else world_bbox
#     if state and state.upper() == "CA":
#         logger.info("Fetching California satellite fire data")
#     else:
#         logger.info("Fetching global satellite fire data")
#     day_range = 1
#     today = str(date.today())

#     # near realtime satellites
#     satellites = ["VIIRS_NOAA21_NRT", "LANDSAT_NRT", "MODIS_NRT"]
#     essential_cols = [
#         "latitude",
#         "longitude",
#         "acq_date",
#         "acq_time",
#         "confidence",
#         "satellite",
#     ]

#     df_list = []

#     async with httpx.AsyncClient(timeout=30.0) as client:
#         for satellite in satellites:
#             # returns in CSV format
#             url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{map_key}/{satellite}/{bbox}/{day_range}/{today}"
#             r = await client.get(url)

#             if r.status_code == 200:
#                 # turn CSV -> string -> dataframe -> append to df_list
#                 csv_file_object = StringIO(r.text.strip())
#                 satellite_df = pd.read_csv(csv_file_object, sep=",")
#                 satellite_df["satellite"] = satellite
#                 df_list.append(satellite_df[essential_cols])
#                 logger.info(f"Successfully fetched data from {satellite}")
#             else:
#                 logger.warning(
#                     f"Failed to fetch from {satellite}: status {r.status_code}"
#                 )

#     # return empty array if API call fails
#     if not df_list:
#         return []

#     # concatinate df_list into one
#     df = pd.concat(df_list, ignore_index=True)

#     # list of dictionaries -> geojson
#     data = df.to_dict(orient="records")
#     geojson = dicts_to_geojson(data)
#     return geojson


# async def fetch_fire_perimeters(state: str | None = None):
#     """
#     Returns GeoJSON of fire perimeter data from NIFC
#     Set state="CA" for California only, otherwise returns global data
#     """
#     params = {
#         "where": "1=1",
#         "outFields": "*",
#         "returnGeometry": "true",
#         "f": "geojson",
#         "outSR": 4326,
#         "resultRecordCount": 2000,
#     }

#     if state and state.upper() == "CA":
#         url = "https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/CA_Perimeters_NIFC_FIRIS_public_view/FeatureServer/0/query"
#         logger.info("Fetching California fire perimeters")
#     else:
#         url = "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query"
#         logger.info("Fetching USA fire perimeters")

#     async with httpx.AsyncClient(timeout=30.0) as client:
#         r = await client.get(url, params=params)

#         r.raise_for_status()
#         geojson = r.json()

#     return geojson


# async def fetch_prescribed_fires(state: str | None = None):
#     """
#     Returns GeoJSON of prescribed fires from Watch Duty
#     Set state="CA" for California only, otherwise returns global data
#     """
#     params = {
#         "where": "1=1",
#         "outFields": "*",
#         "returnGeometry": "true",
#         "f": "geojson",
#         "outSR": 4326,
#         "resultRecordCount": 2000,
#     }

#     if state and state.upper() == "CA":
#         params["geometry"] = "-124.5,32.5,-114.1,42.0"
#         params["geometryType"] = "esriGeometryEnvelope"
#         params["spatialRel"] = "esriSpatialRelIntersects"
#         logger.info("Fetching California prescribed fires")

#     async with httpx.AsyncClient(timeout=30.0) as client:
#         url = "https://services5.arcgis.com/VNhSlpl1umSknM3q/arcgis/rest/services/Watch_Duty_Prescribed_Fires/FeatureServer/0/query"
#         r = await client.get(url, params=params)

#         r.raise_for_status()
#         geojson = r.json()

#     return geojson


# async def data_ingestion_worker():
#     interval = 60.0  # seconds

#     while True:
#         try:
#             # run api calls
#             results = await asyncio.gather(
#                 fetch_satellite_api(state="CA"),
#                 fetch_fire_perimeters(state="CA"),
#                 fetch_prescribed_fires(state="CA"),
#             )

#             # cache the payload
#             # 600 = 10 min time till expiration
#             app_cache["latest_fire_data"] = results
#             print("Cache successfully updated.")

#             # suspend the task for a set interval before polling again
#             await asyncio.sleep(interval)

#         except asyncio.CancelledError:
#             print("Data ingestion worker gracefully shutting down.")
#             break

#         except Exception as error:
#             print(f"Ingestion failure: {error}")
#             # TODO: In a production environment, implement exponential backoff here.
#             await asyncio.sleep(10)


# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     """Manages the startup and shutdown sequence of the FastAPI application."""
#     # Startup logic: instantiate the background worker
#     ingestion_task = asyncio.create_task(data_ingestion_worker())

#     yield  # The FastAPI server handles incoming client requests during this yield

#     # Shutdown logic: cancel the worker to prevent memory leaks
#     ingestion_task.cancel()
#     try:
#         await ingestion_task
#     except asyncio.CancelledError:
#         pass


# """
# --- Server API Endpoints ---
# """

# app = FastAPI(lifespan=lifespan)
# app.add_middleware(GZipMiddleware, minimum_size=1000)


# @app.get("/")
# def read_root():
#     return {"Hello": "World"}


# @app.get("/api/v1/fires")
# async def get_cached_fires():
#     """
#     Client endpoint. Returns data directly from memory in O(1) time,
#     bypassing external network latency entirely.
#     """

#     return app_cache.get("latest_fire_data")
#     # if cached:
#     #     current_time = asyncio.get_event_loop().time()
#     #     if current_time < cached["expires"]:
#     #         return json.loads(cached["data"])  # convert str -> dict
#     # return Response(
#     #     status_code=503, content="Data not yet available, please retry shortly"
