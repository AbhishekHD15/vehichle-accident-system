from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .utils.validators import (ACCIDENT_ID_RE, normalize_phone, normalize_vehicle_number,
                               validate_password_strength)

Role = Literal["ADMIN", "OWNER", "FAMILY", "INSURANCE"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- auth / users ----------
class RegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str | None = None
    password: str
    role: Literal["OWNER", "FAMILY"] = "OWNER"  # ADMIN / INSURANCE can only be created by an admin

    _p = field_validator("password")(validate_password_strength)
    _ph = field_validator("phone")(normalize_phone)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class RefreshIn(BaseModel):
    refresh_token: str


class UserOut(ORM):
    id: int
    full_name: str
    email: EmailStr
    phone: str | None
    role: Role
    organization: str | None
    is_active: bool
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class AdminUserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str | None = None
    password: str
    role: Role
    organization: str | None = None
    _p = field_validator("password")(validate_password_strength)
    _ph = field_validator("phone")(normalize_phone)


class AdminUserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: str | None = None
    role: Role | None = None
    organization: str | None = None
    is_active: bool | None = None
    _ph = field_validator("phone")(normalize_phone)


class PasswordReset(BaseModel):
    new_password: str
    _p = field_validator("new_password")(validate_password_strength)


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    phone: str | None = None
    current_password: str | None = None
    new_password: str | None = None
    _ph = field_validator("phone")(normalize_phone)

    @field_validator("new_password")
    @classmethod
    def _np(cls, v):
        return validate_password_strength(v) if v else v


# ---------- vehicles ----------
class VehicleIn(BaseModel):
    vehicle_number: str
    owner_id: int | None = None  # admin only; owners always own their vehicles
    vehicle_model: str | None = Field(default=None, max_length=80)
    vehicle_type: str | None = Field(default=None, max_length=40)
    insurance_policy_number: str | None = Field(default=None, max_length=60)
    insurance_company: str | None = Field(default=None, max_length=120)
    insurance_expiry_date: date | None = None
    _vn = field_validator("vehicle_number")(normalize_vehicle_number)


class VehicleOut(ORM):
    id: int
    vehicle_number: str
    owner_id: int
    vehicle_model: str | None
    vehicle_type: str | None
    insurance_policy_number: str | None
    insurance_company: str | None
    insurance_expiry_date: date | None
    device_id: str | None
    created_at: datetime


class FamilyShareIn(BaseModel):
    email: EmailStr


# ---------- device payloads ----------
class DeviceAccidentIn(BaseModel):
    accident_id: str
    latitude: float | None = None
    longitude: float | None = None
    gps_valid: bool = False
    acceleration_g: float | None = Field(default=None, ge=0, le=500)
    gyroscope_data: dict[str, Any] | None = None
    accident_date: datetime | None = None
    accident_status: Literal["DETECTED", "CANCELLED", "EMERGENCY_DISPATCHED"]
    cancellation_status: Literal["NONE", "REQUESTED", "CANCELLED"] = "NONE"
    description: str | None = Field(default=None, max_length=500)

    @field_validator("accident_id")
    @classmethod
    def _aid(cls, v):
        if not ACCIDENT_ID_RE.match(v):
            raise ValueError("Invalid accident_id format")
        return v


class HeartbeatIn(BaseModel):
    firmware_version: str | None = Field(default=None, max_length=40)
    gps_valid: bool | None = None
    signal_quality: int | None = None
    pending_events: int | None = None


class NotificationStatusIn(BaseModel):
    accident_id: str
    recipient_type: Literal["FAMILY", "INSURANCE", "EMERGENCY"]
    recipient_phone: str
    notification_type: Literal["SMS", "CALL"] = "SMS"
    message: str | None = Field(default=None, max_length=1000)
    delivery_status: Literal["PENDING", "SUBMITTED", "DELIVERED", "FAILED", "UNKNOWN"]
    modem_response: str | None = Field(default=None, max_length=500)
    retry_count: int = Field(default=0, ge=0, le=100)
    sent_at: datetime | None = None
    _ph = field_validator("recipient_phone")(normalize_phone)


# ---------- accidents / claims ----------
class AccidentPatch(BaseModel):
    description: str | None = Field(default=None, max_length=500)
    accident_status: Literal["RESOLVED", "FALSE_ALARM"] | None = None  # admin only


class ClaimCreate(BaseModel):
    accident_id: str
    claim_amount: float | None = Field(default=None, ge=0, le=1e9)
    claim_description: str | None = Field(default=None, max_length=2000)


class ClaimStatusUpdate(BaseModel):
    claim_status: Literal["IN_PROGRESS", "APPROVED", "REJECTED", "SETTLED"]
    remarks: str | None = Field(default=None, max_length=2000)
    rejection_reason: str | None = Field(default=None, max_length=2000)


class DeviceCreate(BaseModel):
    device_id: str = Field(pattern=r"^[A-Z0-9]{2,12}$")
    vehicle_id: int | None = None


class DeviceUpdate(BaseModel):
    device_status: Literal["ACTIVE", "DISABLED"] | None = None
    vehicle_id: int | None = None
