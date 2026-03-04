from fastapi import FastAPI, Response
import pandas as pd
from datetime import date
from io import StringIO
import os
import json
import logging

import httpx

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()


"""
Functions to make
- Get satellite CSV data 
- Get Current Fire Perimeter Data 
- Get Official Government announcement data 
"""


"""
---Server API Endpoints---
"""


@app.get("/satellite")
async def call_satellite_api():
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

    # return empty json array if API call fails
    if not df_list:
        return Response(content=json.dumps([]), media_type="application/json")

    # concatinate all satelite dataframes into one
    df = pd.concat(df_list, ignore_index=True)

    # convert into json format
    return Response(content=df.to_json(orient="records"), media_type="application/json")


@app.get("/fire_perimeters")
async def call_fire_perimeters():
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
        data = r.json()

    return data


@app.get("/")
def read_root():
    return {"Hello": "World"}
