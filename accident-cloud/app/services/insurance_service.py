from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Accident, InsuranceClaim, User
from ..schemas import ClaimCreate, ClaimStatusUpdate
from ..utils.generate_accident_id import generate_claim_id
from . import accident_service, audit, realtime

TRANSITIONS = {
    "SUBMITTED": {"IN_PROGRESS", "APPROVED", "REJECTED"},
    "IN_PROGRESS": {"APPROVED", "REJECTED"},
    "APPROVED": {"SETTLED"},
    "REJECTED": {"IN_PROGRESS"},  # re-opened on appeal
    "SETTLED": set(),
}


def visible_claims_stmt(user: User):
    stmt = select(InsuranceClaim).join(Accident, InsuranceClaim.accident_id == Accident.id)
    if user.role == "FAMILY":  # family never sees insurance data
        raise HTTPException(403, "Insufficient permissions")
    return accident_service.scope_accidents(stmt, user)


def get_visible_claim(db: Session, user: User, claim_id: str) -> InsuranceClaim:
    claim = db.scalar(visible_claims_stmt(user).where(InsuranceClaim.claim_id == claim_id))
    if not claim:
        raise HTTPException(404, "Claim not found")
    return claim


def serialize(c: InsuranceClaim) -> dict:
    a = c.accident
    return {
        "claim_id": c.claim_id, "accident_id": a.accident_id, "vehicle_number": a.vehicle.vehicle_number,
        "owner_name": a.owner.full_name, "policy_number": c.policy_number,
        "insurance_company": c.insurance_company,
        "claim_amount": float(c.claim_amount) if c.claim_amount is not None else None,
        "claim_status": c.claim_status, "claim_description": c.claim_description,
        "submitted_at": c.submitted_at, "reviewed_at": c.reviewed_at,
        "reviewed_by": c.reviewer.full_name if c.reviewer else None,
        "review_remarks": c.review_remarks, "rejection_reason": c.rejection_reason,
        "latitude": a.latitude if a.gps_valid else None, "longitude": a.longitude if a.gps_valid else None,
        "accident_date": a.accident_date, "accident_status": a.accident_status,
    }


def submit_claim(db: Session, user: User, p: ClaimCreate) -> InsuranceClaim:
    acc = accident_service.get_visible_accident(db, user, p.accident_id)
    if user.role not in ("OWNER", "ADMIN"):
        raise HTTPException(403, "Only the vehicle owner can submit a claim")
    if acc.accident_status in ("CANCELLED", "FALSE_ALARM"):
        raise HTTPException(409, "A claim cannot be raised for a cancelled or false-alarm event")
    if acc.claim:
        raise HTTPException(409, "A claim already exists for this accident")
    v = acc.vehicle
    claim = InsuranceClaim(
        claim_id=generate_claim_id(), accident_id=acc.id, policy_number=v.insurance_policy_number,
        insurance_company=v.insurance_company, claim_amount=p.claim_amount, claim_description=p.claim_description,
        claim_status="SUBMITTED", submitted_at=datetime.now(timezone.utc))
    db.add(claim)
    db.flush()
    audit.log(db, user.id, "CLAIM_SUBMITTED", "claim", claim.claim_id, None, {"claim_status": "SUBMITTED"})
    db.commit()
    db.refresh(acc)
    realtime.emit(db, acc, "claim_submitted")
    return claim


def update_status(db: Session, user: User, claim: InsuranceClaim, p: ClaimStatusUpdate) -> InsuranceClaim:
    if p.claim_status not in TRANSITIONS.get(claim.claim_status, set()):
        raise HTTPException(409, f"Cannot move claim from {claim.claim_status} to {p.claim_status}")
    if p.claim_status == "REJECTED" and not (p.rejection_reason and p.rejection_reason.strip()):
        raise HTTPException(422, "A rejection reason is required")
    prev = {"claim_status": claim.claim_status, "rejection_reason": claim.rejection_reason}
    claim.claim_status = p.claim_status
    claim.reviewed_by, claim.reviewed_at = user.id, datetime.now(timezone.utc)
    claim.review_remarks = p.remarks
    claim.rejection_reason = p.rejection_reason if p.claim_status == "REJECTED" else None
    audit.log(db, user.id, "CLAIM_STATUS_CHANGED", "claim", claim.claim_id, prev,
              {"claim_status": p.claim_status, "remarks": p.remarks, "rejection_reason": claim.rejection_reason})
    db.commit()
    realtime.emit(db, claim.accident, "claim_updated")
    return claim
