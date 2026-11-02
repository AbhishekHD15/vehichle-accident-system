from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user, require_roles
from ..models import Accident, FamilyAccess, User, Vehicle
from ..schemas import FamilyShareIn, VehicleIn, VehicleOut
from ..services import accident_service, audit

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


def _get(db: Session, user: User, vehicle_id: int) -> Vehicle:
    v = db.scalar(accident_service.scope_vehicles(select(Vehicle).where(Vehicle.id == vehicle_id), user))
    if not v:
        raise HTTPException(404, "Vehicle not found")
    return v


def _manageable(db, user, vehicle_id) -> Vehicle:
    if user.role not in ("OWNER", "ADMIN"):
        raise HTTPException(403, "Insufficient permissions")
    return _get(db, user, vehicle_id)


@router.post("", response_model=VehicleOut, status_code=201)
def create_vehicle(p: VehicleIn, user: User = Depends(require_roles("OWNER", "ADMIN")), db: Session = Depends(get_db)):
    owner_id = user.id
    if user.role == "ADMIN":
        if not p.owner_id or not db.get(User, p.owner_id):
            raise HTTPException(422, "owner_id is required and must exist")
        owner_id = p.owner_id
    v = Vehicle(owner_id=owner_id, **p.model_dump(exclude={"owner_id"}))
    db.add(v)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Vehicle number already registered")
    audit.log(db, user.id, "VEHICLE_CREATED", "vehicle", v.id, None, {"vehicle_number": v.vehicle_number})
    db.commit()
    return v


@router.get("", response_model=list[VehicleOut])
def list_vehicles(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(accident_service.scope_vehicles(select(Vehicle), user).order_by(Vehicle.id)).all()


@router.get("/{vehicle_id}")
def get_vehicle(vehicle_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    v = _get(db, user, vehicle_id)
    out = VehicleOut.model_validate(v).model_dump()
    if user.role == "FAMILY":  # no insurance data for family members
        for k in ("insurance_policy_number", "insurance_company", "insurance_expiry_date"):
            out[k] = None
    latest = db.scalar(select(Accident).where(Accident.vehicle_id == v.id).order_by(Accident.accident_date.desc()))
    out["owner_name"] = v.owner.full_name
    out["owner_phone"] = v.owner.phone if user.role in ("OWNER", "ADMIN", "FAMILY") else None
    out["latest_accident"] = accident_service.serialize(latest, user) if latest else None
    return out


@router.put("/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(vehicle_id: int, p: VehicleIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    v = _manageable(db, user, vehicle_id)
    prev = {"vehicle_number": v.vehicle_number, "insurance_company": v.insurance_company}
    for k, val in p.model_dump(exclude={"owner_id"}).items():
        setattr(v, k, val)
    if user.role == "ADMIN" and p.owner_id and db.get(User, p.owner_id):
        v.owner_id = p.owner_id
    audit.log(db, user.id, "VEHICLE_UPDATED", "vehicle", v.id, prev, {"vehicle_number": v.vehicle_number})
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Vehicle number already registered")
    return v


@router.delete("/{vehicle_id}", status_code=204)
def delete_vehicle(vehicle_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    v = _manageable(db, user, vehicle_id)
    if db.scalar(select(func.count()).select_from(Accident).where(Accident.vehicle_id == v.id)):
        raise HTTPException(409, "Vehicle has accident records and cannot be deleted (records are preserved)")
    if v.device_id:
        raise HTTPException(409, "Unassign the IoT device before deleting the vehicle")
    audit.log(db, user.id, "VEHICLE_DELETED", "vehicle", v.id, {"vehicle_number": v.vehicle_number}, None)
    for fa in db.scalars(select(FamilyAccess).where(FamilyAccess.vehicle_id == v.id)):
        db.delete(fa)
    db.delete(v)
    db.commit()


# ---- explicit family sharing ----
@router.get("/{vehicle_id}/family")
def list_family(vehicle_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    v = _manageable(db, user, vehicle_id)
    rows = db.execute(select(User).join(FamilyAccess, FamilyAccess.user_id == User.id)
                      .where(FamilyAccess.vehicle_id == v.id)).scalars().all()
    return [{"user_id": u.id, "full_name": u.full_name, "email": u.email} for u in rows]


@router.post("/{vehicle_id}/family", status_code=201)
def share_with_family(vehicle_id: int, p: FamilyShareIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    v = _manageable(db, user, vehicle_id)
    target = db.scalar(select(User).where(User.email == p.email.lower(), User.role == "FAMILY", User.is_active))
    if not target:
        raise HTTPException(404, "No active FAMILY account with that email")
    if db.scalar(select(FamilyAccess).where(FamilyAccess.vehicle_id == v.id, FamilyAccess.user_id == target.id)):
        raise HTTPException(409, "Already shared")
    db.add(FamilyAccess(vehicle_id=v.id, user_id=target.id))
    audit.log(db, user.id, "FAMILY_SHARED", "vehicle", v.id, None, {"user_id": target.id})
    db.commit()
    return {"user_id": target.id, "full_name": target.full_name, "email": target.email}


@router.delete("/{vehicle_id}/family/{user_id}", status_code=204)
def unshare(vehicle_id: int, user_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    v = _manageable(db, user, vehicle_id)
    fa = db.scalar(select(FamilyAccess).where(FamilyAccess.vehicle_id == v.id, FamilyAccess.user_id == user_id))
    if not fa:
        raise HTTPException(404, "Not shared with that user")
    db.delete(fa)
    audit.log(db, user.id, "FAMILY_UNSHARED", "vehicle", v.id, {"user_id": user_id}, None)
    db.commit()
