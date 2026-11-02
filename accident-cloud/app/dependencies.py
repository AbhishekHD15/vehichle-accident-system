from datetime import datetime, timezone

import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import get_db
from .models import Device, User
from .security import decode_token, verify_device_key

bearer = HTTPBearer(auto_error=False)


def get_current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer),
                     db: Session = Depends(get_db)) -> User:
    err = HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated",
                        headers={"WWW-Authenticate": "Bearer"})
    if not creds:
        raise err
    try:
        data = decode_token(creds.credentials, "access")
        user = db.get(User, int(data["sub"]))
    except (jwt.PyJWTError, ValueError, KeyError):
        raise err
    if not user or not user.is_active:
        raise err
    return user


def require_roles(*roles: str):
    """Backend RBAC. The frontend's role checks are cosmetic; this is the real enforcement."""
    def dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user
    return dep


def get_current_device(x_device_id: str = Header(default=""), x_device_key: str = Header(default=""),
                       authorization: str = Header(default=""), db: Session = Depends(get_db)) -> Device:
    """Credentials come either as X-Device-Id / X-Device-Key headers, or as a SINGLE header
    `Authorization: Device <id>:<key>` (handy for modems whose HTTP stack accepts one custom header)."""
    err = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid device credentials")
    if authorization.startswith("Device ") and ":" in authorization:
        x_device_id, _, x_device_key = authorization[7:].partition(":")
    if not x_device_id or not x_device_key:
        raise err
    device = db.scalar(select(Device).where(Device.device_id == x_device_id))
    if not device or not verify_device_key(x_device_key, device.device_key_hash):
        raise err
    if device.device_status != "ACTIVE":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Device disabled")
    device.last_seen = datetime.now(timezone.utc)
    db.commit()
    return device
