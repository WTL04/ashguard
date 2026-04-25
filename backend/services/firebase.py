import os
import firebase_admin
from firebase_admin import credentials

"""
Authenticating Server's Firebase Service Account
"""


def initialize_firebase():
    if firebase_admin._apps:
        return

    path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not path:
        raise RuntimeError("GOOGLE_APPLICATION_CREDENTIALS is not set")

    cred = credentials.Certificate(path)
    firebase_admin.initialize_app(cred)
