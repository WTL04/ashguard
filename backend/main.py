import os
import asyncio
from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from routers.geo_data import router as geo_data_router
from routers.places import router as places_router
from routers.incidents import router as incidents_router
from routers.self_report import router as self_reports_router
from routers.cache import router as cache_router

from services.redis import (
    connect as redis_connect,
    get_redis,
    disconnect as redis_disconnect,
)
from services.firebase import (
    connect as firebase_connect,
    disconnect as firebase_disconnect,
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
    await firebase_connect()

    workers = [
        *await start_workers(await get_redis()),
        asyncio.create_task(incidents_sync_worker()),
    ]

    yield

    for worker in workers:
        worker.cancel()
    await asyncio.gather(*workers, return_exceptions=True)

    await redis_disconnect()
    await firebase_disconnect()


app = FastAPI(lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.get("/")
def read_root():
    return {"status": "ok", "message": "AshGuard API is running"}


# Routes
# GET  /api/v1/geoData                            - geo_data_router
app.include_router(geo_data_router)
# GET  /api/v1/places/nearby                      - places_router
# GET  /api/v1/places/details                     - places_router
app.include_router(places_router)
# POST /api/v1/incidents/sync                     - incidents_router
app.include_router(incidents_router)
# GET  /api/v1/self-reports                       - self_reports_router
# POST /api/v1/self-reports                       - self_reports_router
app.include_router(self_reports_router)
# GET  /api/v1/cache/status                       - cache_router
# DEL  /api/v1/cache/flush                        - cache_router
app.include_router(cache_router)
