import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from redis.asyncio import Redis
from services.redis import get_pubsub
from services.auth import verify_token

router = APIRouter()


@router.websocket("/ws/{chat_id}")
async def websocket_endpoint(websocket: WebSocket, chat_id: str):
    await websocket.accept()

    auth_header = websocket.headers.get("authorization")
    if not auth_header:
        await websocket.close(code=4001, reason="Missing authorization header")
        return

    try:
        # get auth header
        sender_uid = await verify_token(auth_header)
    except Exception:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    # handshake and subscribe
    redis: Redis = await get_pubsub()
    pubsub = redis.pubsub()
    await pubsub.subscribe(f"conversation:{chat_id}")

    try:
        # websocket listening for any messages
        while True:
            message = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=1.0
            )

            # fan out messages to subscribed clients
            if message and message["type"] == "message":
                await websocket.send_text(message["data"])

            await asyncio.sleep(0.01)  # yields control back to event loop

    except WebSocketDisconnect:
        await pubsub.unsubscribe(f"conversation:{chat_id}")
    finally:
        await pubsub.unsubscribe(f"conversation:{chat_id}")
