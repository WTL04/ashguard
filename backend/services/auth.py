import os
import firebase_admin
from firebase_admin import auth
from fastapi import HTTPException, Header

import services.firebase

"""
Authenticating users using JWT tokens in HTTP Headers
"""


async def verify_token(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid auth header")

    token = authorization.split("Bearer ")[1]

    try:
        decoded = auth.verify_id_token(token)
        return decoded["uid"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

