import logging
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import false, func, select
from sqlalchemy.orm import Session

from ..models import Accident, Device, FamilyAccess, InsuranceClaim, User, Vehicle
from ..schemas import DeviceAccidentIn
from ..utils.validators import validate_gps
from . import audit, realtime

log = logging.getLogger("accidents")
TERMINAL = {"CANCELLED", "EMERGENCY_DISPATCHED"}


# ------------------------- visibility (RBAC data scoping) -------------------------
def scope_vehicles(stmt, user: User):
    if user.role == "ADMIN":
        return stmt
    if user.role == "OWNER":
        return stmt.where(Vehicle.owner_id == user.id)
    if user.role == "FAMILY":
        return stmt.where(Vehicle.id.in_(select(FamilyAccess.vehicle_id).where(FamilyAccess.user_id == user.id)))
    if user.role == "INSURANCE" and user.organization:
        return stmt.where(func.lower(Vehicle.insurance_company) == user.organization.lower())
    return stmt.where(false())


def scope_accidents(stmt, user: User):
    if user.role == "ADMIN":
        return stmt
    if user.role == "OWNER":
        return stmt.where(Accident.owner_id == user.id)
    ids = scope_vehicles(select(Vehicle.id), user)
    return stmt.where(Accident.vehicle_id.in_(ids))


def get_visible_accident(db: Session, user: User, accident_id: str) -> Accident:
    acc = db.scalar(scope_accidents(select(Accident).where(Accident.accident_id == accident_id), user))
    if not acc:  # 404 (not 403) so IDs of other people's records are not revealed
        raise HTTPException(404, "Accident not found")
    return acc


# ------------------------- serialisation with role-based redaction -------------------------
def maps_url(a: Accident) -> str | None:
    if a.gps_valid and a.latitude is not None and a.longitude is not None:
        return f"https://www.google.com/maps?q={a.latitude},{a.longitude}"
    return None


def serialize(a: Accident, user: User) -> dict:
    claim = a.claim
    d = {
        "accident_id": a.accident_id,
        "vehicle_id": a.vehicle_id,
        "vehicle_number": a.vehicle.vehicle_number,
        "owner_name": a.owner.full_name,
        "gps_valid": a.gps_valid,
        "latitude": a.latitude if a.gps_valid else None,
        "longitude": a.longitude if a.gps_valid else None,
        "google_maps_url": maps_url(a),
        "accident_date": a.accident_date,
        "accident_status": a.accident_status,
        "cancellation_status": a.cancellation_status,
        "description": a.description,
        "created_at": a.created_at,
        "updated_at": a.updated_at,
    }
    if user.role != "FAMILY":  # family: no telemetry / insurance data
        d.update({
            "acceleration_g": a.acceleration_g,
            "gyroscope_data": a.gyroscope_data,
            "claim_status": claim.claim_status if claim else "NOT_INITIATED",
            "claim_id": claim.claim_id if claim else None,
            "insurance_company": a.vehicle.insurance_company,
        })
    return d


# ------------------------- device ingestion (idempotent) -------------------------
def upsert_from_device(db: Session, device: Device, p: DeviceAccidentIn) -> tuple[Accident, bool]:
    if device.vehicle_id is None:
        raise HTTPException(409, "Device is not assigned to a vehicle")
    existing = db.scalar(select(Accident).where(Accident.accident_id == p.accident_id))
    if existing:
        if existing.vehicle_id != device.vehicle_id:
            raise HTTPException(409, "accident_id belongs to another vehicle")
        # Retry of an upload. Only allow DETECTED -> terminal; a dispatched alert is never
        # silently turned into CANCELLED (and vice versa).
        if existing.accident_status == "DETECTED" and p.accident_status in TERMINAL:
            prev = {"accident_status": existing.accident_status, "cancellation_status": existing.cancellation_status}
            existing.accident_status = p.accident_status
            existing.cancellation_status = p.cancellation_status
            lat, lon, ok = validate_gps(p.latitude, p.longitude, p.gps_valid)
            if ok and not existing.gps_valid:
                existing.latitude, existing.longitude, existing.gps_valid = lat, lon, True
            audit.log(db, None, "DEVICE_STATUS_UPDATE", "accident", existing.accident_id, prev,
                      {"accident_status": existing.accident_status})
            db.commit()
            realtime.emit(db, existing, "accident_updated")
        return existing, False

    vehicle = db.get(Vehicle, device.vehicle_id)
    lat, lon, ok = validate_gps(p.latitude, p.longitude, p.gps_valid)
    acc = Accident(
        accident_id=p.accident_id, vehicle_id=vehicle.id, owner_id=vehicle.owner_id,
        latitude=lat, longitude=lon, gps_valid=ok, acceleration_g=p.acceleration_g,
        gyroscope_data=p.gyroscope_data, accident_date=p.accident_date or datetime.now(timezone.utc),
        accident_status=p.accident_status, cancellation_status=p.cancellation_status,
        description=p.description,
    )
    db.add(acc)
    try:
        db.commit()
    except Exception:  # concurrent duplicate upload raced us on the unique constraint
        db.rollback()
        again = db.scalar(select(Accident).where(Accident.accident_id == p.accident_id))
        if again:
            return again, False
        raise
    realtime.emit(db, acc, "accident_created")
    return acc, True
