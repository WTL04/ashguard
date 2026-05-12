import logging
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from calfire_incidents import sync_calfire_incidents


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["incidents"])


@router.post("/incidents/sync")
async def manual_sync_incidents():
    """
    Manually triggers a CalFire RSS sync into Firestore.
    Useful for testing or forcing an immediate update.
    """
    try:
        count = await sync_calfire_incidents()
        return {"message": "Sync complete", "incidents_processed": count}
    except Exception as e:
        logger.error(f"Manual sync failed: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Sync failed: {str(e)}"},
        )

