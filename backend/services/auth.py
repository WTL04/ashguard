import os
from firebase_admin import auth
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

"""
Authenticating Users using JSON Web Tokens in HTTP Headers
"""

security = HTTPBearer()


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    token = credentials.credentials

    try:
        decoded = auth.verify_id_token(token)
        return decoded["uid"]
    except Exception as e:
        print(f"Firebase Auth Error: {e}")  # Log the actual error to your console
        raise HTTPException(status_code=401, detail="Invalid or expired token")
