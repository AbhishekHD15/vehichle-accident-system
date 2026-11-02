from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..dependencies import get_current_device
from ..limiter import limiter
from ..models import Device
from ..schemas import DeviceAccidentIn, HeartbeatIn, NotificationStatusIn
from ..services import accident_service, notification_service
from datetime import datetime, timezone

router = APIRouter(prefix="/device", tags=["device"])


@router.post("/accidents")
@limiter.limit(settings.DEVICE_RATE_LIMIT)
def device_accident(request: Request, response: Response, p: DeviceAccidentIn,
                    device: Device = Depends(get_current_device), db: Session = Depends(get_db)):
    """Idempotent: re-posting the same accident_id returns 200 and never creates a duplicate."""
    acc, created = accident_service.upsert_from_device(db, device, p)
    response.status_code = 201 if created else 200
    return {"accident_id": acc.accident_id, "created": created, "accident_status": acc.accident_status,
            "cancellation_status": acc.cancellation_status}


@router.post("/heartbeat")
@limiter.limit(settings.DEVICE_RATE_LIMIT)
def heartbeat(request: Request, p: HeartbeatIn, device: Device = Depends(get_current_device),
              db: Session = Depends(get_db)):
    if p.firmware_version:
        device.firmware_version = p.firmware_version
        db.commit()
    return {"server_time": datetime.now(timezone.utc).isoformat(),
            "retry_notifications": notification_service.pending_retries_for_device(db, device)}


@router.post("/notifications/status")
@limiter.limit(settings.DEVICE_RATE_LIMIT)
def device_notification_status(request: Request, p: NotificationStatusIn,
                               device: Device = Depends(get_current_device), db: Session = Depends(get_db)):
    n = notification_service.device_report(db, device, p)
    return {"id": n.id, "delivery_status": n.delivery_status}
