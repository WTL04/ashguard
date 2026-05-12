from fastapi import APIRouter, Depends
from services.redis import get_redis
from redis.asyncio import Redis
from workers.dataset_workers import CACHE_CONFIGS
import json
import logging


logger = logging.getLogger(__name__)

EMPTY_FEATURE_COLLECTION = {"type": "FeatureCollection", "features": []}

router = APIRouter(prefix="/api/v1", tags=["geo"])


@router.get("/geoData")
async def get_cached_data(redis_client: Redis = Depends(get_redis)):
    """
    Returns all geo data from Redis cache.
    Missing datasets fall back to empty FeatureCollections.
    """
    response_data = {}
    missing = []

    for name, config in CACHE_CONFIGS.items():
        raw = await redis_client.get(config["key"])
        if raw:
            response_data[name] = json.loads(raw)
        else:
            response_data[name] = EMPTY_FEATURE_COLLECTION
            missing.append(name)

    if missing:
        logger.warning(f"Serving empty collections for: {missing}")

    return response_data
