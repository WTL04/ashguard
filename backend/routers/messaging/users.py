import logging
from fastapi import APIRouter, Depends, HTTPException
from services.firestore import get_db
from services.auth import verify_token

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/api/v1", tags=["users"])


@router.get("/users/me")
async def get_current_user(
    sender_uid: str = Depends(verify_token),
    db=Depends(get_db),
):
    user_snap = await db.collection("users").document(sender_uid).get()

    if not user_snap.exists:
        raise HTTPException(status_code=404, detail="User not found")

    data = user_snap.to_dict()

    return {
        "uid": sender_uid,
        "firstName": data.get("firstName", ""),
        "lastName": data.get("lastName", ""),
        "username": data.get("username", ""),
        "photoURL": data.get("photoURL", ""),
        "phone": data.get("phone", ""),
    }


@router.get("/users")
async def get_users(
    sender_uid: str = Depends(verify_token),
    db=Depends(get_db),
):
    users = []
    async for doc in db.collection("users").stream():
        data = doc.to_dict()
        users.append(
            {
                "uid": doc.id,
                "firstName": data.get("firstName", ""),
                "lastName": data.get("lastName", ""),
                "username": data.get("username", ""),
                "photoURL": data.get("photoURL", ""),
                "phone": data.get("phone", ""),
            }
        )

    return {"users": users}


@router.get("/chats")
async def get_chats(
    sender_uid: str = Depends(verify_token),
    db=Depends(get_db),
):
    chats = []

    chats_ref = (
        db.collection("chats")
        .where("participants", "array_contains", sender_uid)
        .order_by("lastMessageAt", direction="DESCENDING")
    )

    async for doc in chats_ref.stream():
        data = doc.to_dict()
        chats.append(
            {
                "id": doc.id,
                "participants": data.get("participants", []),
                "participantDetails": data.get("participantDetails", {}),
                "lastMessage": data.get("lastMessage"),
                "lastMessageAt": data.get("lastMessageAt"),
                "lastMessageSenderId": data.get("lastMessageSenderId"),
                "unreadCounts": data.get("unreadCounts", {}),
                "createdAt": data.get("createdAt"),
            }
        )

    return {"chats": chats}
