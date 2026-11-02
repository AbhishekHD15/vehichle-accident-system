from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Device, User, Vehicle
from ..security import generate_device_key, hash_device_key
from . import audit


def create_device(db: Session, admin: User, device_id: str, vehicle_id: int | None) -> tuple[Device, str]:
    if db.scalar(select(Device).where(Device.device_id == device_id)):
        raise HTTPException(409, "device_id already registered")
    key = generate_device_key()
    dev = Device(device_id=device_id, device_key_hash=hash_device_key(key))
    db.add(dev)
    db.flush()
    if vehicle_id is not None:
        assign(db, dev, vehicle_id)
    audit.log(db, admin.id, "DEVICE_CREATED", "device", device_id)
    db.commit()
    return dev, key  # plaintext key is returned exactly once


def assign(db: Session, dev: Device, vehicle_id: int | None):
    if vehicle_id is None:
        return
    v = db.get(Vehicle, vehicle_id)
    if not v:
        raise HTTPException(404, "Vehicle not found")
    other = db.scalar(select(Device).where(Device.vehicle_id == vehicle_id, Device.id != dev.id))
    if other:
        raise HTTPException(409, "Vehicle already has a device")
    dev.vehicle_id = vehicle_id
    v.device_id = dev.device_id


def rotate_key(db: Session, admin: User, dev: Device) -> str:
    key = generate_device_key()
    dev.device_key_hash = hash_device_key(key)
    audit.log(db, admin.id, "DEVICE_KEY_ROTATED", "device", dev.device_id)
    db.commit()
    return key


def is_online(dev: Device) -> bool:
    return bool(dev.last_seen and datetime.now(timezone.utc) - _aware(dev.last_seen)
                < timedelta(seconds=settings.DEVICE_ONLINE_SECONDS))


def _aware(d: datetime) -> datetime:
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def serialize(dev: Device) -> dict:
    return {"device_id": dev.device_id, "vehicle_id": dev.vehicle_id,
            "vehicle_number": dev.vehicle.vehicle_number if dev.vehicle else None,
            "device_status": dev.device_status, "online": is_online(dev), "last_seen": dev.last_seen,
            "firmware_version": dev.firmware_version, "created_at": dev.created_at}
