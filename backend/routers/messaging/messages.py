import os
import json
import logging
import firebase_admin
from firebase_admin import credentials, firestore_async
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from services.redis import get_redis
from services.auth import verify_token
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["messages"])


class ChatMessage(BaseModel):
    chat_id: str
    text: str


@router.post("/messages")
async def send_message(
    payload: ChatMessage,
    redis: Redis = Depends(get_redis),  # inject Redis client
    sender_uid: str = Depends(verify_token),  # inject Auth header
):
    # connect to firebase to save message history
    if not firebase_admin._apps:
        cred = credentials.Certificate(os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH"))
        firebase_admin.initialize_app(cred)

    created_at = datetime.now(timezone.utc).isoformat()

    result = json.dumps(
        {
            "chat_id": payload.chat_id,
            "text": payload.text,
            "senderId": sender_uid,
            "createdAt": created_at,
        }
    )

    await redis.publish(f"conversation:{payload.chat_id}", result)

    return {"status": "message sent", "chat_id": payload.chat_id}
