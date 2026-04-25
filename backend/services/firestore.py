import logging
from firebase_admin import firestore_async
from services.firebase import initialize_firebase

logger = logging.getLogger(__name__)

_db: firestore_async.AsyncClient | None = None


def get_db() -> firestore_async.AsyncClient:
    global _db
    if _db is not None:
        return _db
    initialize_firebase()
    _db = firestore_async.client()
    logger.info("Firestore client initialized")
    return _db


async def connect():
    global _db
    _db = get_db()


async def disconnect():
    global _db
    _db = None
