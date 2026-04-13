"""
incidents.py
------------
Fetches active California wildfire incidents from the CalFire JSON API
and upserts them into Firestore as pinned official notices.

Firestore collection: threads
Document ID:          "calfire_<incident_id>" (stable, prevents duplicates)

Cleanup rules (run after every sync, even if feed is empty):
  1. Doc is no longer in the active CalFire feed  → delete
  2. Containment reaches 100%                     → delete
  3. updatedAt hasn't changed in STALE_DAYS days  → delete
"""

import os
import logging
import asyncio
import hashlib
from datetime import datetime, timezone, timedelta

import httpx
from google.cloud import firestore
from google.oauth2 import service_account

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

CALFIRE_API_URL = "https://incidents.fire.ca.gov/umbraco/api/IncidentApi/List?inactive=false"
SYNC_INTERVAL   = 900   # seconds — sync every 15 minutes
AUTHOR_NAME     = "CAL FIRE"
AVATAR_COLOR    = "#B45309"
STALE_DAYS      = 3     # delete calfire docs not updated in this many days


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
        _db = firestore.AsyncClient(project=project_id)
        logger.info("Firestore: authenticated via Application Default Credentials")

    return _db


# ── Helpers ───────────────────────────────────────────────────────────────────

def _stable_doc_id(title: str) -> str:
    """
    Derives a stable Firestore document ID from the incident title so the
    same fire never creates a duplicate thread.
    e.g. "Palisades Fire - Los Angeles County" → "calfire_a3f2c1..."
    """
    slug = hashlib.md5(title.strip().lower().encode()).hexdigest()[:12]
    return f"calfire_{slug}"


# ── JSON Parsing ──────────────────────────────────────────────────────────────

def _parse_calfire_json(data: list) -> list[dict]:
    """
    Parses the CalFire JSON API response and returns a list of incident dicts.
    """
    incidents = []

    for item in data:
        name = item.get("Name", "").strip()
        if not name:
            continue

        # Build readable body from available fields
        parts = []
        if item.get("Location"):
            parts.append(f"Location: {item['Location']}")
        if item.get("County"):
            parts.append(f"County: {item['County']}")
        if item.get("AcresBurned") is not None:
            parts.append(f"Acres Burned: {item['AcresBurned']:,}")
        if item.get("PercentContained") is not None:
            parts.append(f"Containment: {item['PercentContained']}%")
        if item.get("Cause"):
            parts.append(f"Cause: {item['Cause']}")
        if item.get("ConditionStatement"):
            parts.append(f"\n{item['ConditionStatement']}")

        url = item.get("Url", "")
        if url:
            parts.append(f"\nMore info: https://www.fire.ca.gov{url}")

        body = "\n".join(parts) if parts else "No additional details available."

        # Parse updated date
        updated_at = datetime.now(timezone.utc)
        for date_field in ("Updated", "Started", "StartedDateOnly"):
            raw = item.get(date_field)
            if raw:
                try:
                    updated_at = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                    break
                except ValueError:
                    pass

        incidents.append({
            "title":      name,
            "body":       body,
            "link":       f"https://www.fire.ca.gov{url}" if url else "",
            "updated_at": updated_at,
            "doc_id":     _stable_doc_id(name),
        })

    logger.info(f"CalFire API: parsed {len(incidents)} active incidents")
    return incidents


# ── Firestore Upsert ──────────────────────────────────────────────────────────

async def _upsert_incident(db: firestore.AsyncClient, incident: dict) -> None:
    """
    Upserts a single incident into Firestore.
    - If the doc doesn't exist: creates it (new fire → new thread)
    - If it exists but the title/body changed: updates it
    - If nothing changed: skips the write
    """
    ref = db.collection("threads").document(incident["doc_id"])
    snap = await ref.get()

    now_ts = firestore.SERVER_TIMESTAMP

    if not snap.exists:
        await ref.set({
            "type":           "official",
            "pinned":         True,
            "title":          incident["title"],
            "body":           incident["body"],
            "tags":           [],
            "distance":       "—",
            "authorId":       "calfire_official",
            "authorUsername": AUTHOR_NAME,
            "avatarColor":    AVATAR_COLOR,
            "address":        "",
            "sourceUrl":      incident["link"],
            "createdAt":      now_ts,
            "updatedAt":      now_ts,
        })
        logger.info(f"Firestore: created incident '{incident['title']}'")
    else:
        existing = snap.to_dict()
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


# ── Cleanup ───────────────────────────────────────────────────────────────────

async def _cleanup_resolved_incidents(
    db: firestore.AsyncClient,
    active_doc_ids: set[str],
) -> None:
    """
    Deletes calfire_ pinned threads that meet any of these conditions:
      1. No longer present in the active CalFire feed (incident closed/removed)
         — if active_doc_ids is empty, ALL calfire_ docs are deleted
      2. Fully contained — body contains 'Containment: 100%'
      3. Not updated in STALE_DAYS days (updatedAt is a real datetime, not SERVER_TIMESTAMP)
    """
    now = datetime.now(timezone.utc)
    stale_cutoff = now - timedelta(days=STALE_DAYS)

    query = db.collection("threads").where("authorId", "==", "calfire_official")
    deleted = 0

    async for doc in query.stream():
        doc_id = doc.id
        data = doc.to_dict() or {}
        title = data.get("title", doc_id)

        # Rule 1: dropped from the active feed entirely
        # (empty active_doc_ids means no active fires → delete everything)
        if doc_id not in active_doc_ids:
            await doc.reference.delete()
            logger.info(f"Firestore: deleted inactive incident '{title}' (not in feed)")
            deleted += 1
            continue

        # Rule 2: fire is 100% contained
        body = data.get("body", "")
        if "Containment: 100%" in body:
            await doc.reference.delete()
            logger.info(f"Firestore: deleted fully-contained incident '{title}'")
            deleted += 1
            continue

        # Rule 3: updatedAt is stale (only applies when value is a real datetime)
        updated_at = data.get("updatedAt")
        if isinstance(updated_at, datetime):
            # Make timezone-aware if naive
            if updated_at.tzinfo is None:
                updated_at = updated_at.replace(tzinfo=timezone.utc)
            if updated_at < stale_cutoff:
                await doc.reference.delete()
                logger.info(f"Firestore: deleted stale incident '{title}' (last updated {updated_at.date()})")
                deleted += 1
                continue

    logger.info(f"Cleanup complete: removed {deleted} resolved/stale incident(s)")


# ── Sync ──────────────────────────────────────────────────────────────────────

async def sync_calfire_incidents() -> int:
    """
    Fetches active CalFire incidents from the JSON API, upserts them into
    Firestore, then removes any that are resolved, fully contained, or stale.

    Cleanup always runs — even if the feed is empty — so stale Firestore
    docs are never left behind when there are no active fires.

    Returns the number of active incidents processed.
    """
    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            r = await client.get(CALFIRE_API_URL)
            r.raise_for_status()
        except httpx.HTTPError as e:
            logger.error(f"CalFire API fetch failed: {e}")
            return 0

    try:
        data = r.json()
    except Exception as e:
        logger.error(f"CalFire API JSON parse failed: {e}")
        return 0

    if not isinstance(data, list):
        logger.warning("CalFire API: unexpected response format")
        return 0

    db = get_db()

    # Parse — may return an empty list when there are no active fires
    incidents = _parse_calfire_json(data)

    # Upsert active incidents (skip if none)
    if incidents:
        await asyncio.gather(*[_upsert_incident(db, inc) for inc in incidents])
    else:
        logger.info("CalFire API: no active incidents — skipping upsert, running cleanup only")

    # Always clean up — empty active_ids deletes all calfire_ docs in Firestore
    active_ids = {inc["doc_id"] for inc in incidents}
    await _cleanup_resolved_incidents(db, active_ids)

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