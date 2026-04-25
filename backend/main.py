from enum import member
import os
import asyncio
from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv

import services.firebase

from routers.geo_data import router as geo_data_router
from routers.places import router as places_router
from routers.incidents import router as incidents_router
from routers.self_report import router as self_reports_router
from routers.cache import router as cache_router
from routers.messaging.messages import router as messages_router
from routers.messaging.websocket import router as websocket_router

from services.redis import (
    connect as redis_connect,
    get_redis,
    disconnect as redis_disconnect,
)
from services.firestore import (
    connect as firestore_connect,
    disconnect as firestore_disconnect,
)
from workers.dataset_workers import start_workers, stop_workers


load_dotenv()

if not os.getenv("NASA_FIRMS_API_KEY"):
    raise RuntimeError("NASA_FIRMS_API_KEY environment variable is not set")

if not os.getenv("GEOAPIFY_API_KEY"):
    raise RuntimeError("GEOAPIFY_API_KEY environment variable is not set")


@asynccontextmanager
async def lifespan(app: FastAPI):
    from calfire_incidents import incidents_sync_worker

    await redis_connect()
    await firestore_connect()

    workers = [
        *await start_workers(await get_redis()),
        asyncio.create_task(incidents_sync_worker()),
    ]

    yield

    for worker in workers:
        worker.cancel()
    await asyncio.gather(*workers, return_exceptions=True)

    await redis_disconnect()
    await firestore_disconnect()


app = FastAPI(lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.get("/")
def read_root():
    return {"status": "ok", "message": "AshGuard API is running"}


app.include_router(geo_data_router)
app.include_router(places_router)
app.include_router(incidents_router)
app.include_router(self_reports_router)
app.include_router(cache_router)
app.include_router(messages_router)
app.include_router(websocket_router)

