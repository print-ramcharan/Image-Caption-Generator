import os
import time
from jose import jwt, JWTError
from google.oauth2 import id_token
from google.auth.transport import requests as grequests
from dotenv import load_dotenv

load_dotenv()
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
JWT_SECRET = os.environ.get('JWT_SECRET', 'change-me')
JWT_ALG = 'HS256'


def verify_google_id_token(token: str):
    """Verify Google ID token and return user info dict with 'sub' and 'email'."""
    if not GOOGLE_CLIENT_ID:
        raise RuntimeError('GOOGLE_CLIENT_ID not set in env')
    try:
        claims = id_token.verify_oauth2_token(token, grequests.Request(), GOOGLE_CLIENT_ID)
        # contains 'sub', 'email'
        return {'sub': claims['sub'], 'email': claims.get('email')}
    except Exception as e:
        raise


def create_jwt(subject: str, email: str, expires_in: int = 60 * 60 * 24 * 7):
    now = int(time.time())
    payload = {
        'sub': subject,
        'email': email,
        'iat': now,
        'exp': now + expires_in,
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)
    return token


def verify_jwt(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return payload
    except JWTError:
        return None
