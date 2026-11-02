from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Accident, Device, Notification, User
from ..schemas import NotificationStatusIn
from ..utils.validators import mask_phone
from . import accident_service, audit, realtime


def device_report(db: Session, device: Device, p: NotificationStatusIn) -> Notification:
    acc = db.scalar(select(Accident).where(Accident.accident_id == p.accident_id))
    if not acc or acc.vehicle_id != device.vehicle_id:
        raise HTTPException(404, "Accident not found for this device")
    n = db.scalar(select(Notification).where(
        Notification.accident_id == acc.id, Notification.recipient_type == p.recipient_type,
        Notification.recipient_phone == p.recipient_phone, Notification.notification_type == p.notification_type))
    if not n:
        n = Notification(accident_id=acc.id, recipient_type=p.recipient_type, recipient_phone=p.recipient_phone,
                         notification_type=p.notification_type, delivery_status="PENDING",
                         retry_count=0, retry_requested=False)
        db.add(n)
    if n.delivery_status == "DELIVERED" and p.delivery_status != "DELIVERED":
        pass  # never regress a delivered notification
    else:
        n.delivery_status = p.delivery_status
    if p.message:
        n.message = p.message
    n.modem_response = p.modem_response
    n.retry_count = max(n.retry_count, p.retry_count)
    n.sent_at = p.sent_at or n.sent_at
    n.retry_requested = False if p.delivery_status in ("SUBMITTED", "DELIVERED") else n.retry_requested
    db.commit()
    realtime.emit(db, acc, "notification_updated")
    return n


def visible_notifications_stmt(user: User):
    stmt = select(Notification).join(Accident, Notification.accident_id == Accident.id)
    stmt = accident_service.scope_accidents(stmt, user)
    if user.role == "FAMILY":
        stmt = stmt.where(Notification.recipient_type.in_(("FAMILY", "EMERGENCY")))
    elif user.role == "INSURANCE":
        stmt = stmt.where(Notification.recipient_type == "INSURANCE")
    return stmt


def serialize(n: Notification, user: User) -> dict:
    full = user.role in ("ADMIN", "OWNER")
    return {
        "id": n.id, "accident_id": n.accident.accident_id, "recipient_type": n.recipient_type,
        "recipient_phone": n.recipient_phone if full else mask_phone(n.recipient_phone),
        "notification_type": n.notification_type, "message": n.message if full else None,
        "delivery_status": n.delivery_status, "modem_response": n.modem_response if user.role == "ADMIN" else None,
        "retry_count": n.retry_count, "retry_requested": n.retry_requested,
        "sent_at": n.sent_at, "created_at": n.created_at,
    }


def request_retry(db: Session, user: User, n: Notification) -> Notification:
    """Website users can only *ask* the vehicle to retry; delivery status itself is only ever
    written by the device endpoint, so it cannot be forged from the website."""
    if n.delivery_status in ("DELIVERED",):
        raise HTTPException(409, "Notification already delivered")
    if n.retry_count >= settings.MAX_NOTIFICATION_RETRIES:
        raise HTTPException(409, "Retry limit reached")
    n.retry_requested = True
    audit.log(db, user.id, "NOTIFICATION_RETRY_REQUESTED", "notification", n.id)
    db.commit()
    return n


def pending_retries_for_device(db: Session, device: Device) -> list[dict]:
    rows = db.execute(
        select(Notification, Accident.accident_id).join(Accident, Notification.accident_id == Accident.id)
        .where(Accident.vehicle_id == device.vehicle_id, Notification.retry_requested.is_(True))
    ).all()
    return [{"notification_id": n.id, "accident_id": aid, "recipient_type": n.recipient_type,
             "recipient_phone": n.recipient_phone, "notification_type": n.notification_type, "message": n.message}
            for n, aid in rows]
