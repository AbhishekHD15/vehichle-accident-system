from .conftest import accident_payload, auth, make_user

API = "/api/v1"


# ---------------- authentication ----------------
def test_register_login_me_and_role_restrictions(client):
    r = client.post(f"{API}/auth/register", json={"full_name": "Ann Owner", "email": "a@x.com", "password": "Passw0rd!123"})
    assert r.status_code == 201 and r.json()["role"] == "OWNER"
    # cannot self-register privileged roles
    for role in ("ADMIN", "INSURANCE"):
        r = client.post(f"{API}/auth/register", json={"full_name": "Bad", "email": f"{role}@x.com",
                                                      "password": "Passw0rd!123", "role": role})
        assert r.status_code == 422
    assert client.post(f"{API}/auth/register", json={"full_name": "Weak", "email": "w@x.com", "password": "short"}).status_code == 422
    assert client.post(f"{API}/auth/login", json={"email": "a@x.com", "password": "wrong-password1"}).status_code == 401
    h = auth(client, "a@x.com")
    assert client.get(f"{API}/auth/me", headers=h).json()["email"] == "a@x.com"
    assert client.get(f"{API}/auth/me").status_code == 401


def test_refresh_rotation_and_reuse_detection(client):
    make_user("r@x.com", "OWNER")
    t = client.post(f"{API}/auth/login", json={"email": "r@x.com", "password": "Passw0rd!123"}).json()
    t2 = client.post(f"{API}/auth/refresh", json={"refresh_token": t["refresh_token"]})
    assert t2.status_code == 200
    # old token re-used => rejected and the whole family revoked
    assert client.post(f"{API}/auth/refresh", json={"refresh_token": t["refresh_token"]}).status_code == 401
    assert client.post(f"{API}/auth/refresh", json={"refresh_token": t2.json()["refresh_token"]}).status_code == 401
    # an access token is not accepted as a refresh token
    assert client.post(f"{API}/auth/refresh", json={"refresh_token": t["access_token"]}).status_code == 401


# ---------------- device authentication ----------------
def test_device_auth(client, world):
    p = accident_payload()
    assert client.post(f"{API}/device/accidents", json=p).status_code == 401
    bad = {"X-Device-Id": "ESP01", "X-Device-Key": "wrong"}
    assert client.post(f"{API}/device/accidents", json=p, headers=bad).status_code == 401
    # a user JWT is not a device credential
    assert client.post(f"{API}/device/accidents", json=p, headers=world["h"]["admin"]).status_code == 401
    assert client.post(f"{API}/device/accidents", json=p, headers=world["dev"]).status_code == 201
    # disabling the device blocks it
    client.patch(f"{API}/admin/devices/ESP01", headers=world["h"]["admin"], json={"device_status": "DISABLED"})
    assert client.post(f"{API}/device/accidents", json=accident_payload("ACC-ESP01-000002"), headers=world["dev"]).status_code == 403


# ---------------- accident creation / duplicates / gps ----------------
def test_idempotent_upload_no_duplicates(client, world):
    p = accident_payload()
    r1 = client.post(f"{API}/device/accidents", json=p, headers=world["dev"])
    r2 = client.post(f"{API}/device/accidents", json=p, headers=world["dev"])
    assert (r1.status_code, r2.status_code) == (201, 200)
    lst = client.get(f"{API}/accidents", headers=world["h"]["owner"]).json()
    assert lst["total"] == 1


def test_dispatched_never_becomes_cancelled(client, world):
    client.post(f"{API}/device/accidents", json=accident_payload(), headers=world["dev"])
    client.post(f"{API}/device/accidents", headers=world["dev"],
                json=accident_payload(accident_status="CANCELLED", cancellation_status="CANCELLED"))
    a = client.get(f"{API}/accidents/ACC-ESP01-000001", headers=world["h"]["owner"]).json()
    assert a["accident_status"] == "EMERGENCY_DISPATCHED" and a["cancellation_status"] == "NONE"


def test_detected_then_terminal_update(client, world):
    client.post(f"{API}/device/accidents", headers=world["dev"], json=accident_payload(accident_status="DETECTED"))
    client.post(f"{API}/device/accidents", headers=world["dev"], json=accident_payload(accident_status="CANCELLED", cancellation_status="CANCELLED"))
    a = client.get(f"{API}/accidents/ACC-ESP01-000001", headers=world["h"]["owner"]).json()
    assert a["accident_status"] == "CANCELLED"


def test_gps_validation(client, world):
    cases = [("ACC-ESP01-000010", dict(latitude=0, longitude=0, gps_valid=True)),
             ("ACC-ESP01-000011", dict(latitude=95, longitude=10, gps_valid=True)),
             ("ACC-ESP01-000012", dict(latitude=12.9, longitude=77.5, gps_valid=False)),
             ("ACC-ESP01-000013", dict(latitude=None, longitude=None, gps_valid=True))]
    for aid, kw in cases:
        assert client.post(f"{API}/device/accidents", headers=world["dev"], json=accident_payload(aid, **kw)).status_code == 201
        a = client.get(f"{API}/accidents/{aid}", headers=world["h"]["owner"]).json()
        assert a["gps_valid"] is False and a["latitude"] is None and a["google_maps_url"] is None
    client.post(f"{API}/device/accidents", headers=world["dev"], json=accident_payload("ACC-ESP01-000014"))
    a = client.get(f"{API}/accidents/ACC-ESP01-000014", headers=world["h"]["owner"]).json()
    assert a["gps_valid"] and a["google_maps_url"] == "https://www.google.com/maps?q=12.97,77.59"


def test_bad_accident_id_rejected(client, world):
    assert client.post(f"{API}/device/accidents", headers=world["dev"], json=accident_payload("../etc")).status_code == 422


def test_website_cannot_create_accidents(client, world):
    assert client.post(f"{API}/accidents", headers=world["h"]["owner"], json=accident_payload()).status_code == 405


# ---------------- retrieval + RBAC ----------------
def test_retrieval_and_filters(client, world):
    client.post(f"{API}/device/accidents", headers=world["dev"], json=accident_payload())
    client.post(f"{API}/device/accidents", headers=world["dev"], json=accident_payload("ACC-ESP01-000002", accident_status="CANCELLED", cancellation_status="CANCELLED"))
    o = world["h"]["owner"]
    assert client.get(f"{API}/accidents?status=CANCELLED", headers=o).json()["total"] == 1
    assert client.get(f"{API}/accidents?vehicle_number=KA-13", headers=o).json()["total"] == 2
    assert client.get(f"{API}/accidents?claim_status=NOT_INITIATED", headers=o).json()["total"] == 2
    assert client.get(f"{API}/accidents?page_size=1", headers=o).json()["items"].__len__() == 1


def test_role_based_data_isolation(client, world):
    client.post(f"{API}/device/accidents", headers=world["dev"], json=accident_payload())
    h = world["h"]
    url = f"{API}/accidents/ACC-ESP01-000001"
    assert client.get(url, headers=h["owner"]).status_code == 200
    assert client.get(url, headers=h["owner2"]).status_code == 404       # other owner
    assert client.get(url, headers=h["admin"]).status_code == 200
    assert client.get(url, headers=h["ins"]).status_code == 200          # matching insurer
    assert client.get(url, headers=h["other-ins"]).status_code == 404    # different insurer
    fam = client.get(url, headers=h["fam"])
    assert fam.status_code == 200 and "claim_status" not in fam.json() and "acceleration_g" not in fam.json()
    assert client.get(f"{API}/claims", headers=h["fam"]).status_code == 403
    assert client.get(f"{API}/dashboard/admin", headers=h["owner"]).status_code == 403
    assert client.get(f"{API}/users", headers=h["owner"]).status_code == 403
    assert client.patch(url, headers=h["fam"], json={"description": "x"}).status_code == 403
    assert client.get(f"{API}/vehicles/{world['vid']}", headers=h["owner2"]).status_code == 404


# ---------------- claims ----------------
def _claim(client, world):
    client.post(f"{API}/device/accidents", headers=world["dev"], json=accident_payload())
    r = client.post(f"{API}/claims", headers=world["h"]["owner"],
                    json={"accident_id": "ACC-ESP01-000001", "claim_amount": 5000, "claim_description": "Bumper"})
    assert r.status_code == 201, r.text
    return r.json()["claim_id"]


def test_claim_submission_rules(client, world):
    cid = _claim(client, world)
    assert client.post(f"{API}/claims", headers=world["h"]["owner"], json={"accident_id": "ACC-ESP01-000001"}).status_code == 409
    client.post(f"{API}/device/accidents", headers=world["dev"], json=accident_payload("ACC-ESP01-000002", accident_status="CANCELLED", cancellation_status="CANCELLED"))
    assert client.post(f"{API}/claims", headers=world["h"]["owner"], json={"accident_id": "ACC-ESP01-000002"}).status_code == 409
    assert client.post(f"{API}/claims", headers=world["h"]["owner2"], json={"accident_id": "ACC-ESP01-000001"}).status_code == 404
    assert client.post(f"{API}/claims", headers=world["h"]["ins"], json={"accident_id": "ACC-ESP01-000001"}).status_code == 403
    a = client.get(f"{API}/accidents/ACC-ESP01-000001", headers=world["h"]["owner"]).json()
    assert a["claim_status"] == "SUBMITTED" and a["claim_id"] == cid


def test_claim_status_updates_and_audit(client, world):
    cid = _claim(client, world)
    s = f"{API}/claims/{cid}/status"
    h = world["h"]
    assert client.patch(s, headers=h["owner"], json={"claim_status": "APPROVED"}).status_code == 403
    assert client.patch(s, headers=h["other-ins"], json={"claim_status": "APPROVED"}).status_code == 404
    assert client.patch(s, headers=h["ins"], json={"claim_status": "REJECTED"}).status_code == 422   # reason required
    assert client.patch(s, headers=h["ins"], json={"claim_status": "SETTLED"}).status_code == 409    # invalid transition
    ok = client.patch(s, headers=h["ins"], json={"claim_status": "IN_PROGRESS", "remarks": "reviewing"})
    assert ok.status_code == 200 and ok.json()["reviewed_by"] == "ins"
    assert client.patch(s, headers=h["ins"], json={"claim_status": "REJECTED", "rejection_reason": "Policy expired"}).status_code == 200
    hist = client.get(f"{API}/claims/{cid}/history", headers=h["owner"]).json()
    assert [x["action"] for x in hist] == ["CLAIM_SUBMITTED", "CLAIM_STATUS_CHANGED", "CLAIM_STATUS_CHANGED"]
    dash = client.get(f"{API}/dashboard/insurance", headers=h["ins"]).json()
    assert dash["rejected_claims"] == 1 and dash["total_accidents"] == 1


# ---------------- notifications ----------------
def test_notification_tracking_and_retry(client, world):
    client.post(f"{API}/device/accidents", headers=world["dev"], json=accident_payload())
    base = {"accident_id": "ACC-ESP01-000001", "recipient_type": "FAMILY", "recipient_phone": "+919999999999",
            "message": "EMERGENCY", "delivery_status": "FAILED", "retry_count": 1}
    r = client.post(f"{API}/device/notifications/status", headers=world["dev"], json=base)
    assert r.status_code == 200
    nid = r.json()["id"]
    h = world["h"]
    # users cannot write delivery status
    assert client.post(f"{API}/device/notifications/status", headers=h["owner"], json=base).status_code == 401
    # owner requests retry; device sees it on heartbeat
    assert client.post(f"{API}/notifications/{nid}/retry", headers=h["owner"]).json()["retry_requested"] is True
    assert client.post(f"{API}/notifications/{nid}/retry", headers=h["fam"]).status_code == 403
    hb = client.post(f"{API}/device/heartbeat", headers=world["dev"], json={"firmware_version": "1.0.0"}).json()
    assert hb["retry_notifications"][0]["notification_id"] == nid
    client.post(f"{API}/device/notifications/status", headers=world["dev"], json={**base, "delivery_status": "SUBMITTED", "retry_count": 2})
    client.post(f"{API}/device/notifications/status", headers=world["dev"], json={**base, "delivery_status": "DELIVERED", "retry_count": 2})
    client.post(f"{API}/device/notifications/status", headers=world["dev"], json={**base, "delivery_status": "SUBMITTED", "retry_count": 2})
    n = client.get(f"{API}/notifications/{nid}", headers=h["owner"]).json()
    assert n["delivery_status"] == "DELIVERED"                  # never regresses
    assert n["retry_requested"] is False
    assert client.post(f"{API}/notifications/{nid}/retry", headers=h["owner"]).status_code == 409
    # still exactly one notification row (no duplicates)
    assert client.get(f"{API}/notifications", headers=h["owner"]).json()["total"] == 1
    # insurer cannot see family notifications; family phone is masked
    assert client.get(f"{API}/notifications", headers=h["ins"]).json()["total"] == 0
    fam = client.get(f"{API}/notifications", headers=h["fam"]).json()["items"][0]
    assert fam["recipient_phone"].endswith("9999") and "*" in fam["recipient_phone"] and fam["message"] is None


def test_vehicle_rules(client, world):
    h = world["h"]
    dup = client.post(f"{API}/vehicles", headers=h["owner2"], json={"vehicle_number": "KA13AB1234"})
    assert dup.status_code == 201  # 'KA13AB1234' != 'KA-13-AB-1234'
    assert client.post(f"{API}/vehicles", headers=h["owner2"], json={"vehicle_number": "KA-13-AB-1234"}).status_code == 409
    client.post(f"{API}/device/accidents", headers=world["dev"], json=accident_payload())
    assert client.delete(f"{API}/vehicles/{dup.json()['id']}", headers=h["owner2"]).status_code == 204
    assert client.delete(f"{API}/vehicles/{world['vid']}", headers=h["owner"]).status_code == 409  # has device + records


def test_device_single_authorization_header(client, world):
    key = world["dev"]["X-Device-Key"]
    ok = {"Authorization": f"Device ESP01:{key}"}
    assert client.post(f"{API}/device/accidents", json=accident_payload("ACC-ESP01-000077"), headers=ok).status_code == 201
    assert client.post(f"{API}/device/heartbeat", json={}, headers={"Authorization": "Device ESP01:nope"}).status_code == 401
