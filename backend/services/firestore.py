import logging
import firebase_admin
from firebase_admin import firestore_async

logger = logging.getLogger(__name__)

import services.firebase

_db: firestore_async.AsyncClient | None = None

"""
Connecting to the firestore to store stuff
"""


def get_db() -> firestore_async.AsyncClient:
    global _db
    if _db is not None:
        return _db
    _db = firestore_async.client()
    logger.info("Firestore client initialized")
    return _db


async def connect():
    global _db
    _db = get_db()


async def disconnect():
    global _db
    _db = None

