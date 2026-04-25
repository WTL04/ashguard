import os
import json
import logging
from firebase_admin import firestore_async
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from services.redis import get_redis
from services.firestore import get_db
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
    db: firestore_async.AsyncClient = Depends(get_db),  # inject firestore
):
    chat_id = payload.chat_id
    text = payload.text
    created_at = datetime.now(timezone.utc).isoformat()

    # connect to firestore to save message history
    await (
        db.collection("pub_sub_test")
        .document(chat_id)
        .collection("messages")
        .add(
            {
                "chat_id": chat_id,
                "text": text,
                "senderId": sender_uid,
                "createdAt": created_at,
            }
        )
    )

    # publish to redis for pub sub
    result = json.dumps(
        {
            "chat_id": chat_id,
            "text": text,
            "senderId": sender_uid,
            "createdAt": created_at,
        }
    )

    await redis.publish(f"conversation:{payload.chat_id}", result)

    return {"status": "message sent", "chat_id": payload.chat_id}
