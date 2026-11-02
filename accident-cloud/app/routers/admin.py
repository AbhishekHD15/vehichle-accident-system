from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import require_roles
from ..models import AuditLog, Device, User
from ..schemas import DeviceCreate, DeviceUpdate
from ..services import audit, device_service as svc

router = APIRouter(prefix="/admin", tags=["admin"])
admin_only = require_roles("ADMIN")


@router.get("/devices")
def list_devices(db: Session = Depends(get_db), _: User = Depends(admin_only)):
    return [svc.serialize(d) for d in db.scalars(select(Device).order_by(Device.id))]


@router.post("/devices", status_code=201)
def create_device(p: DeviceCreate, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    dev, key = svc.create_device(db, admin, p.device_id, p.vehicle_id)
    return {**svc.serialize(dev), "device_key": key,
            "notice": "Store this key now; it cannot be shown again. Flash it into firmware/src/secrets.h."}


def _dev(db, device_id) -> Device:
    d = db.scalar(select(Device).where(Device.device_id == device_id))
    if not d:
        raise HTTPException(404, "Device not found")
    return d


@router.patch("/devices/{device_id}")
def update_device(device_id: str, p: DeviceUpdate, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    d = _dev(db, device_id)
    prev = {"device_status": d.device_status, "vehicle_id": d.vehicle_id}
    if p.device_status:
        d.device_status = p.device_status
    if p.vehicle_id is not None:
        svc.assign(db, d, p.vehicle_id)
    audit.log(db, admin.id, "DEVICE_UPDATED", "device", device_id, prev,
              {"device_status": d.device_status, "vehicle_id": d.vehicle_id})
    db.commit()
    return svc.serialize(d)


@router.post("/devices/{device_id}/rotate-key")
def rotate(device_id: str, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    return {"device_id": device_id, "device_key": svc.rotate_key(db, admin, _dev(db, device_id))}


@router.get("/audit-logs")
def audit_logs(action: str | None = None, entity_type: str | None = None,
               page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
               db: Session = Depends(get_db), _: User = Depends(admin_only)):
    stmt = select(AuditLog)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {"total": total, "page": page, "items": [
        {"id": r.id, "user": r.user.full_name if r.user else "device/system", "action": r.action,
         "entity_type": r.entity_type, "entity_id": r.entity_id, "previous": r.previous_value,
         "new": r.new_value, "created_at": r.created_at} for r in rows]}
