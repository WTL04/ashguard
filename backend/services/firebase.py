import os
import logging
from google.cloud import firestore
from google.oauth2 import service_account


logger = logging.getLogger(__name__)

_db: firestore.AsyncClient | None = None


def get_db() -> firestore.AsyncClient:
    global _db
    if _db is not None:
        return _db

    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    project_id = os.getenv("FIREBASE_PROJECT_ID")

    if not project_id:
        raise RuntimeError("FIREBASE_PROJECT_ID environment variable is not set")

    if creds_path and os.path.exists(creds_path):
        credentials = service_account.Credentials.from_service_account_file(
            creds_path,
            scopes=["https://www.googleapis.com/auth/cloud-platform"],
        )
        _db = firestore.AsyncClient(project=project_id, credentials=credentials)
        logger.info("Firestore: authenticated via service account file")
    else:
        _db = firestore.AsyncClient(project=project_id)
        logger.info("Firestore: authenticated via Application Default Credentials")

    return _db


async def connect():
    global _db
    _db = get_db()


async def disconnect():
    global _db
    if _db:
        await _db.close()
        _db = None

