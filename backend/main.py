from fastapi import FastAPI, Response
import pandas as pd
import asyncio
from contextlib import asynccontextmanager
from datetime import date
from io import StringIO
import os
import logging

# for requests
import httpx

# for data compression
from fastapi.middleware.gzip import GZipMiddleware

# logs success/failed api calls
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# test cache, replace with REDIS python when finished testing
app_cache = {}


"""
--- Helper Functions ---
"""


def dicts_to_geojson(data_list: list) -> dict:
    """
    Converts a list of dictionaries into GeoJSON.
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


async def fetch_satellite_api():
    """
    Returns discionary of satellite detected hotspots from 3 satellite sources
    """

    # get your map key here https://firms.modaps.eosdis.nasa.gov/api/area/html
    # or ask will for his
    # export NASA_FIRMS_API_KEY="your map key"
    map_key = os.getenv("NASA_FIRMS_API_KEY")
    if not map_key:
        raise ValueError("NASA_FIRMS_API_KEY environment variable not set")

    # API variables
    cali_bbox = "-124.5,32.5,-114.1,42.1"
    day_range = 1
    today = str(date.today())

    # near realtime satellites
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
            # returns in CSV format
            url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{map_key}/{satellite}/{cali_bbox}/{day_range}/{today}"
            r = await client.get(url)

            if r.status_code == 200:
                # turn CSV -> string -> dataframe -> append to df_list
                csv_file_object = StringIO(r.text.strip())
                satellite_df = pd.read_csv(csv_file_object, sep=",")
                satellite_df["satellite"] = satellite
                df_list.append(satellite_df[essential_cols])
                logger.info(f"Successfully fetched data from {satellite}")
            else:
                logger.warning(
                    f"Failed to fetch from {satellite}: status {r.status_code}"
                )

    # return empty array if API call fails
    if not df_list:
        return []

    # concatinate df_list into one
    df = pd.concat(df_list, ignore_index=True)

    # list of dictionaries -> geojson
    data = df.to_dict(orient="records")
    geojson = dicts_to_geojson(data)
    return geojson


async def fetch_fire_perimeters():
    """
    Returns GeoJSON of fire perimeter data from NIFC
    """
    params = {
        "where": "1=1",  # SQL-style filter
        "outFields": "*",  # specify which fields to return
        "returnGeometry": "true",
        "f": "geojson",  # format
        "outSR": 4326,  # spatial reference WGS84 latitude/longitude (EPSG:4326)
        "resultRecordCount": 2000,  # page size
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        url = "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query"
        r = await client.get(url, params=params)

        # Check for success and parse JSON
        r.raise_for_status()
        geojson = r.json()

    return geojson


async def fetch_prescribed_fires():
    """
    Returns GeoJSON of prescribed fires from Watch Duty
    """
    params = {
        "where": "1=1",  # SQL-style filter
        "outFields": "*",  # specify which fields to return
        "returnGeometry": "true",
        "f": "geojson",  # format
        "outSR": 4326,  # spatial reference WGS84 latitude/longitude (EPSG:4326)
        "resultRecordCount": 2000,  # page size
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        url = "https://services5.arcgis.com/VNhSlpl1umSknM3q/arcgis/rest/services/Watch_Duty_Prescribed_Fires/FeatureServer/0/query"
        r = await client.get(url, params=params)

        # Check for success and parse JSON
        r.raise_for_status()
        geojson = r.json()

    return geojson


async def data_ingestion_worker():
    interval = 60.0  # seconds

    while True:
        try:
            # run api calls
            results = await asyncio.gather(
                fetch_satellite_api(), fetch_fire_perimeters(), fetch_prescribed_fires()
            )

            # cache the payload
            app_cache["latest_fire_data"] = results
            print("Cache successfully updated.")

            # suspend the task for a set interval before polling again
            await asyncio.sleep(interval)

        except asyncio.CancelledError:
            print("Data ingestion worker gracefully shutting down.")
            break

        except Exception as error:
            print(f"Ingestion failure: {error}")
            # TODO: In a production environment, implement exponential backoff here.
            await asyncio.sleep(10)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manages the startup and shutdown sequence of the FastAPI application."""
    # Startup logic: instantiate the background worker
    ingestion_task = asyncio.create_task(data_ingestion_worker())

    yield  # The FastAPI server handles incoming client requests during this yield

    # Shutdown logic: cancel the worker to prevent memory leaks
    ingestion_task.cancel()
    try:
        await ingestion_task
    except asyncio.CancelledError:
        pass


"""
--- Server API Endpoints ---
"""

app = FastAPI(lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.get("/")
def read_root():
    return {"Hello": "World"}


# TODO: Switch from calling dictionary cache to REDIS cache
@app.get("/api/v1/fires")
async def get_cached_fires():
    """
    Client endpoint. Returns data directly from memory in O(1) time,
    bypassing external network latency entirely.
    """
    return app_cache.get("latest_fire_data", [])
