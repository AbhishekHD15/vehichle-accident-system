from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..dependencies import get_current_user
from ..models import Accident, InsuranceClaim, User, Vehicle
from ..schemas import AccidentPatch
from ..services import accident_service, audit, realtime

router = APIRouter(prefix="/accidents", tags=["accidents"])


@router.get("")
def list_accidents(
    vehicle_number: str | None = None, accident_id: str | None = None,
    date_from: datetime | None = None, date_to: datetime | None = None,
    status: str | None = None, owner_id: int | None = None, claim_status: str | None = None,
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    stmt = accident_service.scope_accidents(select(Accident), user).join(Vehicle, Accident.vehicle_id == Vehicle.id)
    if vehicle_number:
        stmt = stmt.where(Vehicle.vehicle_number.ilike(f"%{vehicle_number.replace(' ', '').upper()}%"))
    if accident_id:
        stmt = stmt.where(Accident.accident_id.ilike(f"%{accident_id}%"))
    if date_from:
        stmt = stmt.where(Accident.accident_date >= date_from)
    if date_to:
        stmt = stmt.where(Accident.accident_date <= date_to)
    if status:
        stmt = stmt.where(Accident.accident_status == status)
    if owner_id and user.role in ("ADMIN", "INSURANCE"):
        stmt = stmt.where(Accident.owner_id == owner_id)
    if claim_status and user.role != "FAMILY":
        if claim_status == "NOT_INITIATED":
            stmt = stmt.where(~Accident.id.in_(select(InsuranceClaim.accident_id)))
        else:
            stmt = stmt.where(Accident.id.in_(select(InsuranceClaim.accident_id).where(InsuranceClaim.claim_status == claim_status)))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.options(joinedload(Accident.vehicle), joinedload(Accident.owner), joinedload(Accident.claim))
                      .order_by(Accident.accident_date.desc()).offset((page - 1) * page_size).limit(page_size)).unique().all()
    return {"items": [accident_service.serialize(a, user) for a in rows], "total": total, "page": page, "page_size": page_size}


@router.get("/{accident_id}")
def get_accident(accident_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return accident_service.serialize(accident_service.get_visible_accident(db, user, accident_id), user)


@router.post("", status_code=405, include_in_schema=False)
def create_forbidden():
    """Accidents are created by authenticated hardware only (POST /device/accidents).
    Allowing website users to create accident records would let them forge emergencies."""
    raise HTTPException(405, "Accidents are created by registered devices via /device/accidents")


@router.patch("/{accident_id}")
def patch_accident(accident_id: str, p: AccidentPatch, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    acc = accident_service.get_visible_accident(db, user, accident_id)
    if user.role not in ("OWNER", "ADMIN"):
        raise HTTPException(403, "Insufficient permissions")
    prev = {"description": acc.description, "accident_status": acc.accident_status}
    if p.description is not None:
        acc.description = p.description
    if p.accident_status:
        if user.role != "ADMIN":
            raise HTTPException(403, "Only administrators can change the accident status")
        acc.accident_status = p.accident_status
    audit.log(db, user.id, "ACCIDENT_UPDATED", "accident", acc.accident_id, prev,
              {"description": acc.description, "accident_status": acc.accident_status})
    db.commit()
    realtime.emit(db, acc, "accident_updated")
    return accident_service.serialize(acc, user)
