import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from .config import settings

_ph = PasswordHasher()
DUMMY_HASH = _ph.hash("dummy-password-for-timing")


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def _encode(payload: dict) -> str:
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: int, role: str) -> str:
    now = datetime.now(timezone.utc)
    return _encode({"sub": str(user_id), "role": role, "typ": "access", "iat": now,
                    "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_MINUTES)})


def create_refresh_token(user_id: int) -> tuple[str, str, datetime]:
    now = datetime.now(timezone.utc)
    jti = uuid.uuid4().hex
    exp = now + timedelta(days=settings.REFRESH_TOKEN_DAYS)
    return _encode({"sub": str(user_id), "typ": "refresh", "jti": jti, "iat": now, "exp": exp}), jti, exp


def decode_token(token: str, expected_type: str) -> dict:
    """Raises jwt.PyJWTError on any problem."""
    data = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    if data.get("typ") != expected_type:
        raise jwt.InvalidTokenError("wrong token type")
    return data


# ---- device credentials: high-entropy random keys, stored only as SHA-256 hashes ----
def generate_device_key() -> str:
    return secrets.token_urlsafe(32)


def hash_device_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def verify_device_key(key: str, key_hash: str) -> bool:
    return hmac.compare_digest(hash_device_key(key), key_hash)
