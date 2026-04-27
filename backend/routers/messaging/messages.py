import json
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer
from redis.asyncio import Redis
from services.redis import get_redis
from services.firestore import get_db
from services.auth import verify_token
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["messages"])
security = HTTPBearer()


class CreateChat(BaseModel):
    other_uid: str


class ChatMessage(BaseModel):
    chat_id: str
    text: str


@router.post("/chats")
async def create_chat(
    payload: CreateChat,
    sender_uid: str = Depends(verify_token),
    db=Depends(get_db),
):
    other_uid = payload.other_uid

    # deterministic chatId -- same two users always get same chat
    # example: userA_uid creates a chat with userB_uid -> chat_id : userA_uid_userB_uid
    chat_id = "_".join(sorted([sender_uid, other_uid]))

    chat_ref = db.collection("chats").document(chat_id)
    chat_snap = await chat_ref.get()

    # return existing chat if it already exists
    if chat_snap.exists:
        return {"chat_id": chat_id, "created": False}

    # fetch both user profiles for participantDetails
    sender_snap = await db.collection("users").document(sender_uid).get()
    other_snap = await db.collection("users").document(other_uid).get()

    if not sender_snap.exists or not other_snap.exists:
        print(f"DEBUG: Sender UID: '{sender_uid}', Exists: {sender_snap.exists}")
        print(f"DEBUG: Other UID: '{other_uid}', Exists: {other_snap.exists}")
        raise HTTPException(status_code=404, detail="One or more users not found")

    sender_data = sender_snap.to_dict()
    other_data = other_snap.to_dict()

    await chat_ref.set(
        {
            "participants": [sender_uid, other_uid],
            "participantDetails": {
                sender_uid: {
                    "firstName": sender_data.get("firstName", ""),
                    "lastName": sender_data.get("lastName", ""),
                    "username": sender_data.get("username", ""),
                    "photoURL": sender_data.get("photoURL", ""),
                },
                other_uid: {
                    "firstName": other_data.get("firstName", ""),
                    "lastName": other_data.get("lastName", ""),
                    "username": other_data.get("username", ""),
                    "photoURL": other_data.get("photoURL", ""),
                },
            },
            "unreadCounts": {
                sender_uid: 0,
                other_uid: 0,
            },
            "lastMessage": None,
            "lastMessageAt": None,
            "lastMessageSenderId": None,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
    )

    return {"chat_id": chat_id, "created": True}


@router.post("/messages")
async def send_message(
    payload: ChatMessage,
    redis: Redis = Depends(get_redis),
    sender_uid: str = Depends(verify_token),
    db=Depends(get_db),
):
    chat_id = payload.chat_id
    text = payload.text
    created_at = datetime.now(timezone.utc).isoformat()

    # read chat document and verify sender is a participant
    chat_ref = db.collection("chats").document(chat_id)
    chat_snap = await chat_ref.get()

    if not chat_snap.exists:
        raise HTTPException(status_code=404, detail="Chat not found")

    chat_data = chat_snap.to_dict()
    participants = chat_data.get("participants", [])

    if sender_uid not in participants:
        raise HTTPException(status_code=403, detail="Not a participant of this chat")

    # write message to Firestore
    await chat_ref.collection("messages").add(
        {
            "text": text,
            "senderId": sender_uid,
            "createdAt": created_at,
        }
    )

    # update unread counts
    unread_counts = chat_data.get("unreadCounts", {})
    for uid in participants:
        if uid != sender_uid:
            unread_counts[uid] = unread_counts.get(uid, 0) + 1
    unread_counts[sender_uid] = 0

    # update chat metadata
    await chat_ref.update(
        {
            "lastMessage": text,
            "lastMessageAt": created_at,
            "lastMessageSenderId": sender_uid,
            "unreadCounts": unread_counts,
        }
    )

    # publish to Redis for real-time delivery
    await redis.publish(
        f"conversation:{chat_id}",
        json.dumps(
            {
                "chat_id": chat_id,
                "text": text,
                "senderId": sender_uid,
                "createdAt": created_at,
            }
        ),
    )

    return {"status": "message sent", "chat_id": chat_id}


@router.get("/messages/{chat_id}")
async def get_messages(
    chat_id: str,
    sender_uid: str = Depends(verify_token),
    db=Depends(get_db),
):
    # confirm requesting user is a participant
    chat_ref = db.collection("chats").document(chat_id)
    chat_snap = await chat_ref.get()

    if not chat_snap.exists:
        raise HTTPException(status_code=404, detail="Chat not found")

    chat_data = chat_snap.to_dict()
    participants = chat_data.get("participants", [])

    if sender_uid not in participants:
        raise HTTPException(status_code=403, detail="Not a participant of this chat")

    # fetch messages ordered by createdAt
    messages_ref = (
        db.collection("chats")
        .document(chat_id)
        .collection("messages")
        .order_by("createdAt")
    )

    messages = []
    async for doc in messages_ref.stream():
        data = doc.to_dict()
        messages.append(
            {
                "id": doc.id,
                "text": data.get("text"),
                "senderId": data.get("senderId"),
                "createdAt": data.get("createdAt"),
            }
        )

    return {"chat_id": chat_id, "messages": messages}


@router.post("/chats/{chat_id}/read")
async def mark_chat_as_read(
    chat_id: str,
    sender_uid: str = Depends(verify_token),
    db=Depends(get_db),
):
    chat_ref = db.collection("chats").document(chat_id)
    chat_snap = await chat_ref.get()

    if not chat_snap.exists:
        raise HTTPException(status_code=404, detail="Chat not found")

    chat_data = chat_snap.to_dict()
    participants = chat_data.get("participants", [])

    if sender_uid not in participants:
        raise HTTPException(status_code=403, detail="Not a participant of this chat")

    unread_counts = chat_data.get("unreadCounts", {})
    unread_counts[sender_uid] = 0

    await chat_ref.update({"unreadCounts": unread_counts})

    return {
        "status": "read",
        "chat_id": chat_id,
        "unreadCounts": unread_counts,
    }
