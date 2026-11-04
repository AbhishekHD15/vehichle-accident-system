from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import require_roles
from ..models import (Accident, AuditLog, Device, InsuranceClaim, Notification, User, Vehicle)
from ..schemas import VehicleOut
from ..services import accident_service as acs, device_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _count(db, stmt):
    return db.scalar(select(func.count()).select_from(stmt.subquery())) or 0


def _claim_counts(db, user):
    stmt = select(InsuranceClaim.claim_status, func.count()).join(Accident, InsuranceClaim.accident_id == Accident.id)
    stmt = acs.scope_accidents(stmt, user).group_by(InsuranceClaim.claim_status)
    return {k: v for k, v in db.execute(stmt).all()}


def _by_month(db, user):
    since = datetime.now(timezone.utc) - timedelta(days=183)
    rows = db.scalars(acs.scope_accidents(select(Accident.accident_date).where(Accident.accident_date >= since), user)).all()
    out: dict[str, int] = {}
    for d in rows:
        out[d.strftime("%Y-%m")] = out.get(d.strftime("%Y-%m"), 0) + 1
    return [{"month": k, "count": out[k]} for k in sorted(out)]


@router.get("/owner")
def owner(user: User = Depends(require_roles("OWNER")), db: Session = Depends(get_db)):
    vehicles = db.scalars(acs.scope_vehicles(select(Vehicle), user)).all()
    acc_stmt = acs.scope_accidents(select(Accident), user)
    latest = db.scalar(acc_stmt.order_by(Accident.accident_date.desc()))
    notif = db.execute(acs.scope_accidents(select(Notification.delivery_status, func.count())
                                           .join(Accident, Notification.accident_id == Accident.id), user)
                       .group_by(Notification.delivery_status)).all()
    return {"total_vehicles": len(vehicles), "total_accidents": _count(db, acc_stmt),
            "latest_accident": acs.serialize(latest, user) if latest else None,
            "claim_status_counts": _claim_counts(db, user), "notification_status_counts": {k: v for k, v in notif},
            "vehicles": [VehicleOut.model_validate(v).model_dump(mode="json") for v in vehicles],
            "accidents_by_month": _by_month(db, user)}


@router.get("/family")
def family(user: User = Depends(require_roles("FAMILY")), db: Session = Depends(get_db)):
    vehicles = db.scalars(acs.scope_vehicles(select(Vehicle), user)).all()
    latest = db.scalar(acs.scope_accidents(select(Accident), user).order_by(Accident.accident_date.desc()))
    return {
        "vehicles": [{"id": v.id, "vehicle_number": v.vehicle_number, "vehicle_model": v.vehicle_model,
                      "vehicle_type": v.vehicle_type, "owner_name": v.owner.full_name, "owner_phone": v.owner.phone}
                     for v in vehicles],
        "latest_accident": acs.serialize(latest, user) if latest else None,
    }


@router.get("/insurance")
def insurance(user: User = Depends(require_roles("INSURANCE")), db: Session = Depends(get_db)):
    claims = _claim_counts(db, user)
    week = datetime.now(timezone.utc) - timedelta(days=7)
    acc = acs.scope_accidents(select(Accident), user)
    return {
        "organization": user.organization,
        "total_vehicles": _count(db, acs.scope_vehicles(select(Vehicle), user)),
        "total_accidents": _count(db, acc),
        "new_accident_notifications": _count(db, acc.where(Accident.accident_status == "EMERGENCY_DISPATCHED",
                                                           Accident.created_at >= week)),
        "pending_claims": claims.get("SUBMITTED", 0) + claims.get("IN_PROGRESS", 0),
        "approved_claims": claims.get("APPROVED", 0), "rejected_claims": claims.get("REJECTED", 0),
        "settled_claims": claims.get("SETTLED", 0), "claim_status_counts": claims,
        "accidents_by_month": _by_month(db, user),
    }


@router.get("/admin")
def admin(user: User = Depends(require_roles("ADMIN")), db: Session = Depends(get_db)):
    devices = db.scalars(select(Device).order_by(Device.id)).all()
    latest = db.scalar(select(Accident).order_by(Accident.accident_date.desc()))
    recent_accidents = db.scalars(select(Accident).order_by(Accident.accident_date.desc()).limit(5)).all()
    return {
        "total_users": _count(db, select(User)), "total_vehicles": _count(db, select(Vehicle)),
        "total_devices": len(devices), "total_accidents": _count(db, select(Accident)),
        "total_claims": _count(db, select(InsuranceClaim)),
        "pending_notifications": _count(db, select(Notification).where(Notification.delivery_status.in_(("PENDING", "FAILED", "UNKNOWN")))),
        "devices": [device_service.serialize(d) for d in devices],
        "online_devices": sum(1 for d in devices if device_service.is_online(d)),
        "latest_accident": acs.serialize(latest, user) if latest else None,
        "recent_accidents": [acs.serialize(a, user) for a in recent_accidents],
        "accidents_by_month": _by_month(db, user),
    }
