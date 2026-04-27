import logging
from fastapi import APIRouter, Depends
from services.redis import get_redis
from redis.asyncio import Redis
from workers.dataset_workers import CACHE_CONFIGS


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["cache"])


@router.get("/cache/status")
async def cache_status(redis: Redis = Depends(get_redis)):
    """
    Shows per-dataset Redis cache health and TTL remaining.
    """
    try:
        memory = await redis.info("memory")
        datasets = {}

        for name, config in CACHE_CONFIGS.items():
            key = config["key"]
            ttl = await redis.ttl(key)
            exists = await redis.exists(key)
            datasets[name] = {
                "cache_exists": bool(exists),
                "ttl_seconds_remaining": ttl,
            }

        return {
            "datasets": datasets,
            "redis_used_memory": memory.get("used_memory_human"),
            "redis_connected": True,
        }
    except Exception as e:
        return {
            "datasets": {},
            "redis_connected": False,
            "error": str(e),
        }


@router.delete("/cache/flush")
async def flush_cache(redis: Redis = Depends(get_redis)):
    """
    Clears all dataset caches.
    """
    keys = [config["key"] for config in CACHE_CONFIGS.values()]
    await redis.delete(*keys)
    return {"message": "All caches cleared", "keys_flushed": keys}