"""
incidents.py
------------
Fetches active California wildfire incidents from the CalFire RSS feed
and upserts them into Firestore as pinned official notices.

Firestore collection: threads
Document ID:          "calfire_<incident_id>" (stable, prevents duplicates)
"""

import os
import logging
import asyncio
import hashlib
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import httpx
from google.cloud import firestore
from google.oauth2 import service_account

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

CALFIRE_RSS_URL = "https://www.fire.ca.gov/incidents/rss"
SYNC_INTERVAL   = 900   # seconds — sync every 15 minutes
AUTHOR_NAME     = "CAL FIRE"
AVATAR_COLOR    = "#B45309"


# ── Firestore client (lazy singleton) ─────────────────────────────────────────

_db: firestore.AsyncClient | None = None


def get_db() -> firestore.AsyncClient:
    """
    Returns a Firestore async client.
    Authenticates via GOOGLE_APPLICATION_CREDENTIALS (service account JSON path)
    or falls back to Application Default Credentials (works on Cloud Run / GCE).
    """
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
        # Application Default Credentials (Cloud Run, GCE, etc.)
        _db = firestore.AsyncClient(project=project_id)
        logger.info("Firestore: authenticated via Application Default Credentials")

    return _db


# ── RSS Parsing ───────────────────────────────────────────────────────────────

def _stable_doc_id(title: str) -> str:
    """
    Derives a stable Firestore document ID from the incident title so the
    same fire never creates a duplicate thread.
    e.g. "Palisades Fire - Los Angeles County" → "calfire_a3f2c1..."
    """
    slug = hashlib.md5(title.strip().lower().encode()).hexdigest()[:12]
    return f"calfire_{slug}"


def _parse_calfire_rss(xml_text: str) -> list[dict]:
    """
    Parses the CalFire RSS XML and returns a list of incident dicts.
    Each dict has: title, body, link, location, updated_at
    """
    incidents = []

    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        logger.error(f"RSS XML parse error: {e}")
        return incidents

    # RSS 2.0 structure: <rss><channel><item>...
    channel = root.find("channel")
    if channel is None:
        logger.warning("CalFire RSS: no <channel> element found")
        return incidents

    for item in channel.findall("item"):
        title_el       = item.find("title")
        description_el = item.find("description")
        link_el        = item.find("link")
        pub_date_el    = item.find("pubDate")

        if title_el is None or title_el.text is None:
            continue

        title       = title_el.text.strip()
        description = description_el.text.strip() if description_el is not None and description_el.text else ""
        link        = link_el.text.strip() if link_el is not None and link_el.text else ""

        # Parse pub date — used to avoid re-stamping unchanged incidents
        updated_at = None
        if pub_date_el is not None and pub_date_el.text:
            try:
                updated_at = datetime.strptime(
                    pub_date_el.text.strip(), "%a, %d %b %Y %H:%M:%S %z"
                )
            except ValueError:
                updated_at = datetime.now(timezone.utc)
        else:
            updated_at = datetime.now(timezone.utc)

        # Build a clean body: strip HTML tags from description
        import re
        clean_body = re.sub(r"<[^>]+>", "", description).strip()
        if link:
            clean_body += f"\n\nMore info: {link}"

        incidents.append({
            "title":      title,
            "body":       clean_body or "No additional details available.",
            "link":       link,
            "updated_at": updated_at,
            "doc_id":     _stable_doc_id(title),
        })

    logger.info(f"CalFire RSS: parsed {len(incidents)} incidents")
    return incidents


# ── Firestore Upsert ──────────────────────────────────────────────────────────

async def _upsert_incident(db: firestore.AsyncClient, incident: dict) -> None:
    """
    Upserts a single incident into Firestore.
    - If the doc doesn't exist: creates it (new fire → new thread)
    - If it exists but the title/body changed: updates body only
    - If nothing changed: skips the write (no unnecessary Firestore ops)
    """
    ref = db.collection("threads").document(incident["doc_id"])
    snap = await ref.get()

    now_ts = firestore.SERVER_TIMESTAMP

    if not snap.exists:
        await ref.set({
            "type":            "official",
            "pinned":          True,
            "title":           incident["title"],
            "body":            incident["body"],
            "tags":            [],
            "distance":        "—",
            "authorId":        "calfire_official",
            "authorUsername":  AUTHOR_NAME,
            "avatarColor":     AVATAR_COLOR,
            "address":         "",
            "sourceUrl":       incident["link"],
            "createdAt":       now_ts,
            "updatedAt":       now_ts,
        })
        logger.info(f"Firestore: created incident '{incident['title']}'")

    else:
        existing = snap.to_dict()
        # Only write if something meaningful changed
        if (existing.get("title") != incident["title"] or
                existing.get("body") != incident["body"]):
            await ref.update({
                "title":     incident["title"],
                "body":      incident["body"],
                "updatedAt": now_ts,
            })
            logger.info(f"Firestore: updated incident '{incident['title']}'")
        else:
            logger.debug(f"Firestore: no change for '{incident['title']}', skipping")


async def sync_calfire_incidents() -> int:
    """
    Fetches CalFire RSS and upserts all active incidents into Firestore.
    Returns the number of incidents processed.
    """
    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            r = await client.get(CALFIRE_RSS_URL)
            r.raise_for_status()
        except httpx.HTTPError as e:
            logger.error(f"CalFire RSS fetch failed: {e}")
            return 0

    incidents = _parse_calfire_rss(r.text)
    if not incidents:
        logger.warning("CalFire RSS: no incidents parsed — feed may be empty or changed format")
        return 0

    db = get_db()
    # Upsert all incidents concurrently
    await asyncio.gather(*[_upsert_incident(db, inc) for inc in incidents])
    return len(incidents)


# ── Background Worker ─────────────────────────────────────────────────────────

async def incidents_sync_worker() -> None:
    """
    Long-running background task that syncs CalFire incidents every SYNC_INTERVAL seconds.
    Designed to be run as an asyncio task alongside the existing data_ingestion_worker.
    """
    logger.info("CalFire incidents sync worker started")
    while True:
        try:
            count = await sync_calfire_incidents()
            logger.info(f"CalFire sync complete: {count} incidents processed")
        except asyncio.CancelledError:
            logger.info("CalFire sync worker shutting down")
            break
        except Exception as e:
            logger.error(f"CalFire sync worker error: {e}")

        await asyncio.sleep(SYNC_INTERVAL)