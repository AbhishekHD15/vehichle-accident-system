import re

ACCIDENT_ID_RE = re.compile(r"^ACC-[A-Z0-9]{2,12}-\d{4,8}$")
VEHICLE_NUMBER_RE = re.compile(r"^[A-Z0-9-]{4,20}$")
PHONE_RE = re.compile(r"^\+?[0-9]{7,15}$")


def normalize_vehicle_number(v: str) -> str:
    v = re.sub(r"\s+", "", v.strip().upper())
    if not VEHICLE_NUMBER_RE.match(v):
        raise ValueError("Invalid vehicle number")
    return v


def normalize_phone(v: str | None) -> str | None:
    if v is None or v == "":
        return None
    v = re.sub(r"[\s()-]", "", v)
    if not PHONE_RE.match(v):
        raise ValueError("Invalid phone number (use digits with optional leading +)")
    return v


def validate_password_strength(p: str) -> str:
    if len(p) < 10 or not re.search(r"[A-Za-z]", p) or not re.search(r"\d", p):
        raise ValueError("Password must be at least 10 characters and contain letters and digits")
    return p


def validate_gps(lat, lon, gps_valid: bool) -> tuple[float | None, float | None, bool]:
    """Return a sanitized (lat, lon, valid). A location is only 'valid' if the device says so
    AND the numbers are in range AND it is not the (0,0) 'null island' placeholder."""
    if lat is None or lon is None:
        return None, None, False
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None, None, False
    if abs(lat) < 1e-6 and abs(lon) < 1e-6:
        return None, None, False
    if not gps_valid:
        return None, None, False
    return float(lat), float(lon), True


def mask_phone(p: str | None) -> str | None:
    if not p:
        return p
    return "*" * max(len(p) - 4, 0) + p[-4:]
