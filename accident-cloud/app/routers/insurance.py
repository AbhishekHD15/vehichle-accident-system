from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user, require_roles
from ..models import AuditLog, InsuranceClaim, User
from ..schemas import ClaimCreate, ClaimStatusUpdate
from ..services import insurance_service as svc

router = APIRouter(prefix="/claims", tags=["claims"])


@router.post("", status_code=201)
def create_claim(p: ClaimCreate, user: User = Depends(require_roles("OWNER", "ADMIN")), db: Session = Depends(get_db)):
    return svc.serialize(svc.submit_claim(db, user, p))


@router.get("")
def list_claims(status: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    svc.check_and_expire_claims(db)
    stmt = svc.visible_claims_stmt(user)
    if status:
        stmt = stmt.where(InsuranceClaim.claim_status == status)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(InsuranceClaim.submitted_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [svc.serialize(c) for c in rows], "total": total, "page": page, "page_size": page_size}


@router.get("/{claim_id}")
def get_claim(claim_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.serialize(svc.get_visible_claim(db, user, claim_id))


@router.get("/{claim_id}/history")
def claim_history(claim_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    svc.get_visible_claim(db, user, claim_id)  # authorisation check
    rows = db.scalars(select(AuditLog).where(AuditLog.entity_type == "claim", AuditLog.entity_id == claim_id)
                      .order_by(AuditLog.created_at)).all()
    return [{"action": r.action, "by": r.user.full_name if r.user else None, "at": r.created_at,
             "previous": r.previous_value, "new": r.new_value} for r in rows]


@router.patch("/{claim_id}/status")
def update_claim_status(claim_id: str, p: ClaimStatusUpdate,
                        user: User = Depends(require_roles("INSURANCE", "ADMIN")), db: Session = Depends(get_db)):
    claim = svc.get_visible_claim(db, user, claim_id)
    return svc.serialize(svc.update_status(db, user, claim, p))
