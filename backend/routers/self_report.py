import logging
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from services.firestore import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["self-reports"])


class SelfReportCreate(BaseModel):
    latitude: float
    longitude: float
    description: str | None = None


def self_report_doc_to_feature(doc_id: str, data: dict) -> dict:
    return {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [data["longitude"], data["latitude"]],
        },
        "properties": {
            "reportId": doc_id,
            "type": data.get("type", "fire"),
            "status": data.get("status", "pending"),
            "description": data.get("description", ""),
            "source": data.get("source", "user"),
            "createdAt": data.get("createdAt"),
            "updatedAt": data.get("updatedAt"),
            "expiresAt": data.get("expiresAt"),
            "confirmedCount": data.get("confirmedCount", 0),
            "isActive": data.get("isActive", True),
        },
    }


@router.post("/self-reports")
async def create_self_report(payload: SelfReportCreate):
    try:
        db = get_db()
        report_id = f"self_report_{uuid4().hex}"
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=6)

        report_data = {
            "type": "fire",
            "status": "pending",
            "latitude": payload.latitude,
            "longitude": payload.longitude,
            "description": payload.description or "",
            "source": "user",
            "confirmedCount": 0,
            "isActive": True,
            "createdAt": now.isoformat(),
            "updatedAt": now.isoformat(),
            "expiresAt": expires_at.isoformat(),
        }

        await db.collection("self_reports").document(report_id).set(report_data)

        return {
            "message": "Self report created",
            "report": self_report_doc_to_feature(report_id, report_data),
        }
    except Exception as e:
        logger.error(f"Failed to create self report: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Failed to create self report: {str(e)}"},
        )


@router.get("/self-reports")
async def get_self_reports():
    try:
        db = get_db()
        now_iso = datetime.now(timezone.utc).isoformat()

        query = (
            db.collection("self_reports")
            .where("isActive", "==", True)
            .where("expiresAt", ">", now_iso)
        )

        features = []
        async for doc in query.stream():
            data = doc.to_dict()
            features.append(self_report_doc_to_feature(doc.id, data))

        return {
            "type": "FeatureCollection",
            "features": features,
        }
    except Exception as e:
        logger.error(f"Failed to fetch self reports: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Failed to fetch self reports: {str(e)}"},
        )
