import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from redis.asyncio import Redis
from firebase_admin import auth
from services.redis import get_pubsub
from services.firestore import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/{chat_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    chat_id: str,
    token: str = Query(None),
):
    await websocket.accept()

    if not token:
        logger.warning("WS [%s]: rejected - missing token", chat_id)
        await websocket.close(code=4001, reason="Missing token")
        return

    try:
        decoded_token = auth.verify_id_token(token)
        sender_uid = decoded_token["uid"]
        logger.info("WS [%s]: authenticated user=%s", chat_id, sender_uid)
    except Exception as e:
        logger.warning("WS [%s]: auth failed - %s", chat_id, e)
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    db = get_db()
    chat_ref = db.collection("chats").document(chat_id)
    chat_snap = await chat_ref.get()

    if not chat_snap.exists:
        logger.warning("WS [%s]: rejected for user=%s - chat not found", chat_id, sender_uid)
        await websocket.close(code=4004, reason="Chat not found")
        return

    chat_data = chat_snap.to_dict()
    participants = chat_data.get("participants", [])

    if sender_uid not in participants:
        logger.warning(
            "WS [%s]: rejected for user=%s - not a participant",
            chat_id,
            sender_uid,
        )
        await websocket.close(code=4003, reason="Not authorized for this chat")
        return

    logger.info("WS [%s]: membership verified for user=%s", chat_id, sender_uid)

    redis: Redis = await get_pubsub()
    pubsub = redis.pubsub()

    try:
        await pubsub.subscribe(f"conversation:{chat_id}")
        logger.info("WS [%s]: subscribed to Redis", chat_id)

        while True:
            message = await pubsub.get_message(
                ignore_subscribe_messages=True,
                timeout=1.0,
            )

            if message and message["type"] == "message":
                data = message["data"]
                if isinstance(data, bytes):
                    data = data.decode("utf-8")

                await websocket.send_text(data)
                logger.debug("WS [%s]: sent payload to client", chat_id)

            await asyncio.sleep(0.01)

    except WebSocketDisconnect:
        logger.info("WS [%s]: client disconnected normally", chat_id)
    except Exception as e:
        logger.exception("WS [%s]: unexpected error - %s", chat_id, e)
    finally:
        try:
            await pubsub.unsubscribe(f"conversation:{chat_id}")
            await pubsub.aclose()
            logger.info("WS [%s]: unsubscribed and pubsub closed", chat_id)
        except Exception as e:
            logger.warning("WS [%s]: cleanup error - %s", chat_id, e)