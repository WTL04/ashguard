import os
import httpx
import json
import logging
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from services.redis import get_redis
from redis.asyncio import Redis


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["geo"])


GEOAPIFY_API_KEY = os.getenv("GEOAPIFY_API_KEY")
GEOAPIFY_PLACES_URL = "https://api.geoapify.com/v2/places"
GEOAPIFY_DETAILS_URL = "https://api.geoapify.com/v2/place-details"
COORD_PRECISION = 2

GEOAPIFY_CATEGORIES = {
    "hotels": "accommodation.hotel,accommodation.motel,accommodation.guest_house",
    "grocery": "commercial.supermarket",
    "gas": "service.vehicle.fuel",
    "convenience": "commercial.convenience",
    "hospital": "healthcare.hospital",
    "pharmacy": "healthcare.pharmacy",
}


async def fetch_nearby_places(
    lat: float,
    lon: float,
    resource_type: str,
    radius_meters: int = 10000,
    limit: int = 20,
) -> dict:
    if not GEOAPIFY_API_KEY:
        raise ValueError("GEOAPIFY_API_KEY environment variable not set")

    categories = GEOAPIFY_CATEGORIES[resource_type]
    logger.info(
        f"Fetching nearby {resource_type} at ({lat}, {lon}), radius={radius_meters}m"
    )

    params = {
        "categories": categories,
        "filter": f"circle:{lon},{lat},{radius_meters}",
        "bias": f"proximity:{lon},{lat}",
        "limit": limit,
        "lang": "en",
        "apiKey": GEOAPIFY_API_KEY,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(GEOAPIFY_PLACES_URL, params=params)
        r.raise_for_status()
        raw = r.json()

    features = []
    for feature in raw.get("features", []):
        props = feature.get("properties", {})
        geometry = feature.get("geometry", {})

        features.append(
            {
                "type": "Feature",
                "geometry": geometry,
                "properties": {
                    "name": props.get("name"),
                    "address": props.get("formatted"),
                    "address_line1": props.get("address_line1"),
                    "address_line2": props.get("address_line2"),
                    "lat": props.get("lat"),
                    "lon": props.get("lon"),
                    "categories": props.get("categories", []),
                    "place_id": props.get("place_id"),
                    "resource_type": resource_type,
                },
            }
        )

    return {"type": "FeatureCollection", "features": features}


async def fetch_place_details(place_id: str) -> dict:
    if not GEOAPIFY_API_KEY:
        raise ValueError("GEOAPIFY_API_KEY environment variable not set")

    logger.info(f"Fetching place details for place_id={place_id}")

    params = {
        "id": place_id,
        "apiKey": GEOAPIFY_API_KEY,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(GEOAPIFY_DETAILS_URL, params=params)
        r.raise_for_status()
        raw = r.json()

    details_feature = next(
        (
            f
            for f in raw.get("features", [])
            if f.get("properties", {}).get("feature_type") == "details"
        ),
        None,
    )

    if not details_feature:
        return {}

    props = details_feature.get("properties", {})

    return {
        "place_id": place_id,
        "name": props.get("name"),
        "opening_hours": props.get("opening_hours"),
        "phone": props.get("phone"),
        "website": props.get("website"),
    }


@router.get("/places/nearby")
async def get_nearby_places(
    lat: float = Query(...),
    lon: float = Query(...),
    type: str = Query(...),
    radius: int = Query(10000),
    limit: int = Query(20),
    redis: Redis = Depends(get_redis),
):
    if type not in GEOAPIFY_CATEGORIES:
        return JSONResponse(status_code=400, content={"detail": f"Invalid type '{type}'"})

    limit = max(1, min(limit, 100))
    snapped_lat = round(lat, COORD_PRECISION)
    snapped_lon = round(lon, COORD_PRECISION)
    cache_key = f"ashguard:places:{type}:{snapped_lat}:{snapped_lon}:{radius}:{limit}"

    try:
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception as e:
        logger.warning(f"Redis read failed: {e}")

    result = await fetch_nearby_places(lat, lon, type, radius_meters=radius, limit=limit)

    try:
        await redis.setex(cache_key, 3600, json.dumps(result))
    except Exception as e:
        logger.warning(f"Redis write failed: {e}")

    return result


@router.get("/places/details")
async def get_place_details(
    place_id: str = Query(...),
    redis: Redis = Depends(get_redis),
):
    cache_key = f"ashguard:place_details:{place_id}"

    try:
        cached = await redis.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception as e:
        logger.warning(f"Redis read failed: {e}")

    result = await fetch_place_details(place_id)

    if not result:
        return JSONResponse(status_code=404, content={"detail": f"No details found for place_id={place_id}"})

    try:
        await redis.setex(cache_key, 86400, json.dumps(result))
    except Exception as e:
        logger.warning(f"Redis write failed: {e}")

    return result