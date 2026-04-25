import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from redis.asyncio import Redis
from firebase_admin import auth  # Import Firebase auth directly
from services.redis import get_pubsub

router = APIRouter()


@router.websocket("/ws/{chat_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    chat_id: str,
    token: str = Query(None),  # Extracts the token from the URL
):
    await websocket.accept()

    # 1. Check if token exists in URL
    if not token:
        print(f"DEBUG WS [{chat_id}]: Connection rejected - No token in URL")
        await websocket.close(code=4001, reason="Missing token")
        return

    # 2. Verify Token
    try:
        decoded_token = auth.verify_id_token(token)
        sender_uid = decoded_token["uid"]
        print(f"DEBUG WS [{chat_id}]: SUCCESS! User {sender_uid} authenticated.")
    except Exception as e:
        print(f"DEBUG WS [{chat_id}]: FIREBASE ERROR - {e}")
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    # 3. Redis Setup
    redis: Redis = await get_pubsub()
    pubsub = redis.pubsub()
    await pubsub.subscribe(f"conversation:{chat_id}")
    print(f"DEBUG WS [{chat_id}]: Subscribed to Redis channel")

    # 4. Listen for Messages
    try:
        while True:
            message = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=1.0
            )

            if message and message["type"] == "message":
                data = message["data"]
                if isinstance(data, bytes):
                    data = data.decode("utf-8")
                await websocket.send_text(data)
                print(f"DEBUG WS [{chat_id}]: Sent data to client -> {data}")

            await asyncio.sleep(0.01)

    except WebSocketDisconnect:
        print(f"DEBUG WS [{chat_id}]: Client disconnected normally.")
    finally:
        await pubsub.unsubscribe(f"conversation:{chat_id}")
        print(f"DEBUG WS [{chat_id}]: Unsubscribed from Redis.")
