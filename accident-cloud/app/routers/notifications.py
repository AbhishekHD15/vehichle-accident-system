from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user, require_roles
from ..models import Notification, User
from ..services import notification_service as svc

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _get(db, user, nid) -> Notification:
    n = db.scalar(svc.visible_notifications_stmt(user).where(Notification.id == nid))
    if not n:
        raise HTTPException(404, "Notification not found")
    return n


@router.get("")
def list_notifications(accident_id: str | None = None, status: str | None = None,
                       page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                       user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from ..models import Accident
    stmt = svc.visible_notifications_stmt(user)
    if accident_id:
        stmt = stmt.where(Accident.accident_id == accident_id)
    if status:
        stmt = stmt.where(Notification.delivery_status == status)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(Notification.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [svc.serialize(n, user) for n in rows], "total": total, "page": page, "page_size": page_size}


@router.get("/{notification_id}")
def get_notification(notification_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.serialize(_get(db, user, notification_id), user)


@router.post("/{notification_id}/retry")
def retry_notification(notification_id: int, user: User = Depends(require_roles("OWNER", "ADMIN")),
                       db: Session = Depends(get_db)):
    return svc.serialize(svc.request_retry(db, user, _get(db, user, notification_id)), user)
