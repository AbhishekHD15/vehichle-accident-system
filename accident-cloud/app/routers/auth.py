from datetime import datetime, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..dependencies import get_current_user
from ..limiter import limiter
from ..models import RefreshToken, User
from ..schemas import LoginIn, RefreshIn, RegisterIn, TokenOut, UserOut
from ..security import (DUMMY_HASH, create_access_token, create_refresh_token, decode_token,
                        hash_password, verify_password)
from ..services import audit

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue(db: Session, user: User) -> TokenOut:
    refresh, jti, exp = create_refresh_token(user.id)
    db.add(RefreshToken(jti=jti, user_id=user.id, expires_at=exp))
    db.commit()
    return TokenOut(access_token=create_access_token(user.id, user.role), refresh_token=refresh,
                    user=UserOut.model_validate(user))


@router.post("/register", response_model=UserOut, status_code=201)
@limiter.limit(settings.LOGIN_RATE_LIMIT)
def register(request: Request, p: RegisterIn, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == p.email.lower())):
        raise HTTPException(409, "Email already registered")
    user = User(full_name=p.full_name.strip(), email=p.email.lower(), phone=p.phone,
                hashed_password=hash_password(p.password), role=p.role)
    db.add(user)
    db.flush()
    audit.log(db, user.id, "USER_REGISTERED", "user", user.id, None, {"role": user.role})
    db.commit()
    return user


@router.post("/login", response_model=TokenOut)
@limiter.limit(settings.LOGIN_RATE_LIMIT)
def login(request: Request, p: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == p.email.lower()))
    ok = verify_password(p.password, user.hashed_password if user else DUMMY_HASH)  # constant-ish time
    if not user or not ok or not user.is_active:
        raise HTTPException(401, "Invalid email or password")
    return _issue(db, user)


@router.post("/refresh", response_model=TokenOut)
@limiter.limit(settings.LOGIN_RATE_LIMIT)
def refresh(request: Request, p: RefreshIn, db: Session = Depends(get_db)):
    err = HTTPException(401, "Invalid refresh token")
    try:
        data = decode_token(p.refresh_token, "refresh")
    except jwt.PyJWTError:
        raise err
    rec = db.scalar(select(RefreshToken).where(RefreshToken.jti == data["jti"]))
    if not rec:
        raise err
    if rec.revoked:  # reuse of a rotated token => assume theft, kill every session of this user
        for t in db.scalars(select(RefreshToken).where(RefreshToken.user_id == rec.user_id, RefreshToken.revoked.is_(False))):
            t.revoked = True
        db.commit()
        raise err
    user = db.get(User, rec.user_id)
    if not user or not user.is_active:
        raise err
    rec.revoked = True  # rotation: each refresh token is single-use
    return _issue(db, user)


@router.post("/logout", status_code=204)
def logout(p: RefreshIn, db: Session = Depends(get_db)):
    try:
        data = decode_token(p.refresh_token, "refresh")
    except jwt.PyJWTError:
        return
    rec = db.scalar(select(RefreshToken).where(RefreshToken.jti == data["jti"]))
    if rec:
        rec.revoked = True
        db.commit()


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
