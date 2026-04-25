import os
import firebase_admin
from firebase_admin import credentials

"""
Authenticating Firebase Service Account
"""

if not firebase_admin._apps:
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not cred_path:
        raise RuntimeError(
            "GOOGLE_APPLICATION_CREDENTIALS environment variable is not set"
        )
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

