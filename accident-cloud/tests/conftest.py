import os

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["APP_ENV"] = "development"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import User
from app.security import hash_password


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app) as c:
        yield c


def make_user(email, role, org=None, name=None):
    with SessionLocal() as db:
        db.add(User(full_name=name or email.split("@")[0], email=email, role=role, organization=org,
                    hashed_password=hash_password("Passw0rd!123")))
        db.commit()


def auth(client, email, password="Passw0rd!123"):
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture()
def world(client):
    """admin, owner, other owner, family, insurance (AcmeIns), vehicle + device."""
    for e, r, o in [("admin@x.com", "ADMIN", None), ("owner@x.com", "OWNER", None), ("owner2@x.com", "OWNER", None),
                    ("fam@x.com", "FAMILY", None), ("ins@x.com", "INSURANCE", "AcmeIns"),
                    ("other-ins@x.com", "INSURANCE", "OtherIns")]:
        make_user(e, r, o)
    h = {k: auth(client, f"{k}@x.com") for k in ("admin", "owner", "owner2", "fam", "ins")}
    h["other-ins"] = auth(client, "other-ins@x.com")
    v = client.post("/api/v1/vehicles", headers=h["owner"], json={
        "vehicle_number": "ka-13-ab-1234", "insurance_company": "AcmeIns", "insurance_policy_number": "P-1"})
    assert v.status_code == 201, v.text
    vid = v.json()["id"]
    d = client.post("/api/v1/admin/devices", headers=h["admin"], json={"device_id": "ESP01", "vehicle_id": vid})
    assert d.status_code == 201, d.text
    dev = {"X-Device-Id": "ESP01", "X-Device-Key": d.json()["device_key"]}
    assert client.post(f"/api/v1/vehicles/{vid}/family", headers=h["owner"], json={"email": "fam@x.com"}).status_code == 201
    return {"h": h, "vid": vid, "dev": dev}


def accident_payload(aid="ACC-ESP01-000001", **kw):
    p = {"accident_id": aid, "latitude": 12.97, "longitude": 77.59, "gps_valid": True, "acceleration_g": 6.2,
         "gyroscope_data": {"x": 1, "y": 2, "z": 3}, "accident_status": "EMERGENCY_DISPATCHED",
         "cancellation_status": "NONE"}
    p.update(kw)
    return p
