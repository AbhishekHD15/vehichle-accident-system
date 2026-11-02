from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user, require_roles
from ..models import RefreshToken, User
from ..schemas import AdminUserCreate, AdminUserUpdate, PasswordReset, ProfileUpdate, UserOut
from ..security import hash_password, verify_password
from ..services import audit

router = APIRouter(prefix="/users", tags=["users"])
admin_only = require_roles("ADMIN")


@router.patch("/me", response_model=UserOut)
def update_profile(p: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if p.full_name:
        user.full_name = p.full_name.strip()
    if p.phone is not None:
        user.phone = p.phone
    if p.new_password:
        if not p.current_password or not verify_password(p.current_password, user.hashed_password):
            raise HTTPException(400, "Current password is incorrect")
        user.hashed_password = hash_password(p.new_password)
        for t in db.scalars(select(RefreshToken).where(RefreshToken.user_id == user.id)):
            t.revoked = True
        audit.log(db, user.id, "PASSWORD_CHANGED", "user", user.id)
    db.commit()
    return user


@router.get("", response_model=list[UserOut])
def list_users(role: str | None = None, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    stmt = select(User).order_by(User.id)
    if role:
        stmt = stmt.where(User.role == role)
    return db.scalars(stmt).all()


@router.post("", response_model=UserOut, status_code=201)
def create_user(p: AdminUserCreate, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    if db.scalar(select(User).where(User.email == p.email.lower())):
        raise HTTPException(409, "Email already registered")
    if p.role == "INSURANCE" and not p.organization:
        raise HTTPException(422, "Insurance users need an organization (insurance company name)")
    u = User(full_name=p.full_name.strip(), email=p.email.lower(), phone=p.phone, role=p.role,
             organization=p.organization, hashed_password=hash_password(p.password))
    db.add(u)
    db.flush()
    audit.log(db, admin.id, "USER_CREATED", "user", u.id, None, {"role": u.role, "organization": u.organization})
    db.commit()
    return u


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, p: AdminUserUpdate, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found")
    if u.id == admin.id and (p.is_active is False or (p.role and p.role != "ADMIN")):
        raise HTTPException(409, "You cannot disable or demote yourself")
    prev = {"role": u.role, "is_active": u.is_active, "organization": u.organization}
    for k, v in p.model_dump(exclude_unset=True).items():
        setattr(u, k, v)
    if p.is_active is False:
        for t in db.scalars(select(RefreshToken).where(RefreshToken.user_id == u.id)):
            t.revoked = True
    audit.log(db, admin.id, "USER_UPDATED", "user", u.id, prev,
              {"role": u.role, "is_active": u.is_active, "organization": u.organization})
    db.commit()
    return u


@router.post("/{user_id}/reset-password", status_code=204)
def reset_password(user_id: int, p: PasswordReset, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found")
    u.hashed_password = hash_password(p.new_password)
    for t in db.scalars(select(RefreshToken).where(RefreshToken.user_id == u.id)):
        t.revoked = True
    audit.log(db, admin.id, "PASSWORD_RESET_BY_ADMIN", "user", u.id)
    db.commit()
