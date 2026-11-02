"""In-memory WebSocket hub. Events carry only a type + accident_id; clients re-fetch through the
authorised REST API, so nothing sensitive is pushed. Single-process only: for multiple workers
replace with Redis pub/sub (documented in docs/DEPLOYMENT.md). The frontend falls back to polling."""
import asyncio
import logging
from collections import defaultdict

from fastapi import WebSocket
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..models import Accident, FamilyAccess, User, Vehicle

log = logging.getLogger("realtime")


class Hub:
    def __init__(self):
        self.loop: asyncio.AbstractEventLoop | None = None
        self.conns: dict[int, set[WebSocket]] = defaultdict(set)

    async def connect(self, user_id: int, ws: WebSocket):
        self.conns[user_id].add(ws)

    def disconnect(self, user_id: int, ws: WebSocket):
        self.conns[user_id].discard(ws)

    async def _send(self, user_ids: set[int], event: dict):
        for uid in user_ids:
            for ws in list(self.conns.get(uid, ())):
                try:
                    await ws.send_json(event)
                except Exception:
                    self.disconnect(uid, ws)

    def publish(self, user_ids: set[int], event: dict):
        """Callable from sync (threadpool) code."""
        if not self.loop or not user_ids:
            return
        try:
            asyncio.run_coroutine_threadsafe(self._send(user_ids, event), self.loop)
        except Exception:  # never let realtime break the request
            log.exception("realtime publish failed")


hub = Hub()


def recipients_for_accident(db: Session, accident: Accident) -> set[int]:
    vehicle = db.get(Vehicle, accident.vehicle_id)
    ids = {accident.owner_id}
    ids.update(db.scalars(select(FamilyAccess.user_id).where(FamilyAccess.vehicle_id == accident.vehicle_id)))
    conds = [User.role == "ADMIN"]
    if vehicle and vehicle.insurance_company:
        conds.append((User.role == "INSURANCE") & (User.organization.ilike(vehicle.insurance_company)))
    ids.update(db.scalars(select(User.id).where(User.is_active, or_(*conds))))
    return ids


def emit(db: Session, accident: Accident, event_type: str):
    hub.publish(recipients_for_accident(db, accident), {"type": event_type, "accident_id": accident.accident_id})
