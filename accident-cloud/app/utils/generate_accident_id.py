"""Accident IDs are generated ON THE DEVICE (so SMS can carry them while offline) as
ACC-<DEVICE>-<6 digit NVS counter>. The server only validates them. Claim IDs are server side."""
import secrets
from datetime import datetime, timezone


def generate_claim_id() -> str:
    year = datetime.now(timezone.utc).year
    return f"CLM-{year}-{secrets.randbelow(10**6):06d}"


def make_accident_id(device_short: str, counter: int) -> str:
    """Reference implementation (mirrors the firmware); used by tests/tools."""
    return f"ACC-{device_short.upper()}-{counter:06d}"
