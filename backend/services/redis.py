import os
from redis.asyncio import Redis


redis_client: Redis | None = None
redis_pubsub: Redis | None = None


async def connect():
    # set a global variables
    global redis_client, redis_pubsub

    # connect to Redis
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
    redis_client = Redis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)
    redis_pubsub = Redis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)

    # check if client is connected
    try:
        await redis_client.ping()
        print(f"Redis Client connected successfully at: {REDIS_URL}.")
    except Exception as e:
        print(f"Redis Client connection failed: {e}")

    # check if pubsub is connected
    try:
        await redis_pubsub.ping()
        print(f"Redis PubSub connected successfully at: {REDIS_URL}.")
    except Exception as e:
        print(f"Redis PubSub connection failed: {e}")


async def disconnect():
    global redis_client, redis_pubsub
    if redis_client:
        await redis_client.aclose()
    if redis_pubsub:
        await redis_pubsub.aclose()


async def get_redis() -> Redis:
    return redis_client


async def get_pubsub() -> Redis:
    return redis_pubsub
