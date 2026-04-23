import os
from redis.asyncio import Redis


redis_client: Redis | None = None


async def connect():
    global redis_client
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
    redis_client = await Redis.from_url(
        REDIS_URL, encoding="utf-8", decode_responses=True
    )
    try:
        await redis_client.ping()
        print(f"Redis connected successfully at: {REDIS_URL}.")
    except Exception as e:
        print(f"Redis connection failed: {e}")


async def disconnect():
    global redis_client
    if redis_client:
        await redis_client.aclose()


async def get_redis() -> Redis:
    return redis_client

