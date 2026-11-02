import asyncio

import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..database import SessionLocal
from ..models import User
from ..security import decode_token
from ..services.realtime import hub

router = APIRouter(tags=["realtime"])


@router.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    """First client message must be {"token": "<access jwt>"}; the token is NOT put in the URL
    (URLs end up in logs). Server pushes {"type","accident_id"} hints only."""
    await ws.accept()
    user_id = None
    try:
        msg = await asyncio.wait_for(ws.receive_json(), timeout=10)
        data = decode_token(msg.get("token", ""), "access")
        with SessionLocal() as db:
            u = db.get(User, int(data["sub"]))
            if not u or not u.is_active:
                raise ValueError("inactive")
            user_id = u.id
        await hub.connect(user_id, ws)
        await ws.send_json({"type": "ready"})
        while True:
            await ws.receive_text()  # keep-alive pings from client
    except (WebSocketDisconnect, asyncio.TimeoutError, jwt.PyJWTError, ValueError, KeyError, TypeError):
        pass
    finally:
        if user_id is not None:
            hub.disconnect(user_id, ws)
        try:
            await ws.close(code=1008)
        except Exception:
            pass
