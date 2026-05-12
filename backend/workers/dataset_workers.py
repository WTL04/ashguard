import os
import logging
import json
import asyncio
import httpx
import aiohttp
from datetime import date
from io import StringIO
from dotenv import load_dotenv
import pandas as pd
from redis.asyncio import Redis


load_dotenv()

logger = logging.getLogger(__name__)


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
        "poll": 600,  # 10 mins
        "ttl": 1200,  # 20 mins
    },
    "weather_stations": {
        "key": "ashguard:weather_stations",
        "poll": 300,  # 5 mins
        "ttl": 600,  # 10 mins
    },
    "hospitals": {
        "key": "ashguard:hospitals",
        "poll": 86400,  # 1 day
        "ttl": 172800,  # 2 days
    },
}


"""
--- Weather Data Helpers ---
"""

CALIFORNIA_STATION_IDS = [
    "KNGZ",
    "KAAT",
    "KAPV",
    "KACV",
    "KAUN",
    "KAVX",
    "KBFL",
    "KBAB",
    "KBUO",
    "KBYS",
    "KL35",
    "KBIH",
    "KBLH",
    "KL08",
    "KO57",
    "KBAN",
    "KBUR",
    "KBNY",
    "KC83",
    "KCXL",
    "KCMA",
    "KCZZ",
    "KNFG",
    "KCRQ",
    "KO59",
    "KCIC",
    "KNID",
    "KCNO",
    "KO22",
    "KCCR",
    "KAJO",
    "KSNA",
    "KCEC",
    "KDAG",
    "KDWA",
    "KEDU",
    "KDLO",
    "KEDW",
    "K9L2",
    "KNJK",
    "KEMT",
    "KBLU",
    "KEKA",
    "KL18",
    "KFOT",
    "KFCH",
    "KFAT",
    "KFUL",
    "KGOO",
    "KHAF",
    "KHJO",
    "KO18",
    "KHHR",
    "KHWD",
    "KHES",
    "KHMT",
    "KCVH",
    "KHGT",
    "KNRS",
    "KIPL",
    "KIYK",
    "KJAQ",
    "KWJF",
    "KPOC",
    "KWHP",
    "KNLC",
    "KLHM",
    "KLLR",
    "KLVK",
    "KLPC",
    "KLGB",
    "KSLI",
    "KCQT",
    "KLAX",
    "KMAE",
    "KMMH",
    "KMYV",
    "KMHR",
    "KMCC",
    "KMER",
    "KMCE",
    "KNKX",
    "KMOD",
    "KNUQ",
    "KMHV",
    "KSIY",
    "KMRY",
    "KMHS",
    "KMWS",
    "KF70",
    "KAPC",
    "KEED",
    "K3A6",
    "KNZY",
    "KDVO",
    "KOAK",
    "KL52",
    "KOKB",
    "KNXF",
    "KONT",
    "KOVE",
    "KOXR",
    "KGXA",
    "KPMD",
    "KPSP",
    "KPAO",
    "KPRB",
    "KO69",
    "KPVF",
    "KNTD",
    "KPTV",
    "K87Q",
    "KRNM",
    "KRBL",
    "KRDD",
    "KREI",
    "KO32",
    "KO88",
    "KRAL",
    "KRIV",
    "KSAC",
    "KSMF",
    "KSNS",
    "KCPU",
    "KSBD",
    "KSQL",
    "KNUC",
    "KSDB",
    "KSDM",
    "KSAN",
    "KMYF",
    "KSEE",
    "KSFO",
    "KSJC",
    "KRHV",
    "KSBP",
    "KE16",
    "KNSI",
    "KSBA",
    "KSMX",
    "KSMO",
    "KSTS",
    "KIZA",
    "KO87",
    "KTVL",
    "KSCK",
    "KSVE",
    "KTSP",
    "KTRM",
    "KTOA",
    "KTCY",
    "KSUU",
    "KO86",
    "KTRK",
    "KNXP",
    "KUKI",
    "KCCB",
    "KVCB",
    "KVBG",
    "KXVW",
    "KVNY",
    "KVCV",
    "KVIS",
    "KWVI",
    "KO54",
]

NWS_HEADERS = {
    "User-Agent": "AshGuard/1.0 (ashguard-project@example.com)",
    "Accept": "application/geo+json",
}

"""
--- Helper Constants / Functions ---
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
--- Data Fetchers ---
"""


async def fetch_single_station(
    session: aiohttp.ClientSession,
    station_id: str,
    semaphore: asyncio.Semaphore,
) -> dict | None:
    """
    Fetch the most recent valid observation for one NWS station.
    Returns a GeoJSON Feature, or None if the station has no usable data.
    """
    async with semaphore:
        url = f"https://api.weather.gov/stations/{station_id}/observations"
        try:
            await asyncio.sleep(0.2)
            async with session.get(url, headers=NWS_HEADERS, ssl=False) as response:
                response.raise_for_status()
                data = await response.json(content_type=None)

                best_obs = next(
                    (
                        obs
                        for obs in data.get("features", [])
                        if obs.get("properties", {}).get("temperature", {}).get("value")
                        is not None
                    ),
                    None,
                )

                if best_obs is None:
                    return None

                props = best_obs.get("properties", {})
                coords = best_obs.get("geometry", {}).get("coordinates", [None, None])

                return {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": coords,
                    },
                    "properties": {
                        "stationId": station_id,
                        "stationName": props.get("stationName", station_id),
                        "temperature": props.get("temperature", {}).get("value"),
                        "relativeHumidity": props.get("relativeHumidity", {}).get(
                            "value"
                        ),
                        "dewpoint": props.get("dewpoint", {}).get("value"),
                        "windSpeed": props.get("windSpeed", {}).get("value"),
                        "timestamp": props.get("timestamp"),
                    },
                }

        except aiohttp.ClientResponseError as e:
            logger.warning(f"HTTP {e.status} for station {station_id}")
            return None
        except Exception as e:
            logger.warning(f"Error fetching station {station_id}: {e}")
            return None


async def fetch_weather_data() -> dict:
    """
    Fetch current weather observations for California NWS stations
    and return a GeoJSON FeatureCollection.
    """
    logger.info(
        f"Fetching weather data for {len(CALIFORNIA_STATION_IDS)} CA stations..."
    )

    semaphore = asyncio.Semaphore(5)

    async with aiohttp.ClientSession() as session:
        tasks = [
            fetch_single_station(session, station_id, semaphore)
            for station_id in CALIFORNIA_STATION_IDS
        ]
        results = await asyncio.gather(*tasks)

    features = [result for result in results if result is not None]

    logger.info(f"Weather fetch complete: {len(features)} stations with valid data.")
    return {"type": "FeatureCollection", "features": features}


async def fetch_satellite_api(state: str | None = None) -> dict:
    """
    Returns GeoJSON FeatureCollection of satellite-detected hotspots.
    Set state="CA" for California only, otherwise returns global data.
    """
    map_key = os.getenv("NASA_FIRMS_API_KEY")
    if not map_key:
        raise ValueError("NASA_FIRMS_API_KEY environment variable not set")

    cali_bbox = "-124.5,32.5,-114.1,42.1"
    world_bbox = "-180,-90,180,90"
    bbox = cali_bbox if state and state.upper() == "CA" else world_bbox

    logger.info(
        "Fetching California satellite fire data"
        if state and state.upper() == "CA"
        else "Fetching global satellite fire data"
    )

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
            url = (
                f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/"
                f"{map_key}/{satellite}/{bbox}/{day_range}/{today}"
            )
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
    Set state="CA" for California only, otherwise returns USA data.
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
        url = (
            "https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/"
            "CA_Perimeters_NIFC_FIRIS_public_view/FeatureServer/0/query"
        )
        logger.info("Fetching California fire perimeters")
    else:
        url = (
            "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/"
            "WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query"
        )
        logger.info("Fetching USA fire perimeters")

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        return r.json()


async def fetch_prescribed_fires(state: str | None = None) -> dict:
    """
    Returns GeoJSON of prescribed fires from Watch Duty.
    Set state="CA" for California only.
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
        url = (
            "https://services5.arcgis.com/VNhSlpl1umSknM3q/arcgis/rest/services/"
            "Watch_Duty_Prescribed_Fires/FeatureServer/0/query"
        )
        r = await client.get(url, params=params)
        r.raise_for_status()
        return r.json()


async def fetch_shelters() -> dict:
    """
    Returns GeoJSON of currently available Red Cross shelters.
    """
    params = {
        "where": "1=1",
        "outFields": "*",
        "returnGeometry": "true",
        "f": "geojson",
        "outSR": 4326,
        "resultRecordCount": 2000,
    }

    url = (
        "https://services.arcgis.com/pGfbNJoYypmNq86F/arcgis/rest/services/"
        "Open_Shelters/FeatureServer/0/query"
    )
    logger.info("Fetching currently available Red Cross shelters")

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        return r.json()


async def fetch_hospitals(state: str | None = None) -> dict:
    """
    Returns GeoJSON of hospitals.
    Set state="CA" for California only, otherwise returns all hospitals.
    """
    if state and state.upper() == "CA":
        where_clause = "STATE = 'CA'"
        logger.info("Fetching California hospitals")
    else:
        where_clause = "1=1"
        logger.info("Fetching all hospitals")

    params = {
        "where": where_clause,
        "outFields": "*",
        "returnGeometry": "true",
        "f": "geojson",
        "outSR": 4326,
        "resultRecordCount": 2000,
    }

    url = "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/Structures_Medical_Emergency_Response_v1/FeatureServer/0/query"

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        return r.json()


"""
--- Dataworker handeling --- 
"""

FETCH_FUNCTIONS = {
    "satellite_hotspots": lambda: fetch_satellite_api(state="CA"),
    "fire_perimeters": lambda: fetch_fire_perimeters(state="CA"),
    "prescribed_fires": lambda: fetch_prescribed_fires(state="CA"),
    "shelters": fetch_shelters,
    "weather_stations": fetch_weather_data,
    "hospitals": lambda: fetch_hospitals(state="CA"),
}


async def dataset_worker(name: str, redis: Redis):
    config = CACHE_CONFIGS[name]
    key = config["key"]
    poll = config["poll"]
    ttl = config["ttl"]
    fetch_fn = FETCH_FUNCTIONS[name]

    while True:
        try:
            data = await fetch_fn()
            await redis.setex(key, ttl, json.dumps(data))
            logger.info(f"[{name}] Cache updated.")
        except asyncio.CancelledError:
            logger.info(f"[{name}] Worker shutting down.")
            break
        except Exception as e:
            logger.error(f"[{name}] Fetch failed: {e}")

        await asyncio.sleep(poll)


async def start_workers(redis: Redis) -> list[asyncio.Task]:
    return [asyncio.create_task(dataset_worker(name, redis)) for name in CACHE_CONFIGS]


async def stop_workers(tasks: list[asyncio.Task]):
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
