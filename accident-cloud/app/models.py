"""SQLAlchemy models. Schema changes MUST go through Alembic migrations."""
from datetime import date, datetime, timezone

from sqlalchemy import (JSON, Boolean, Date, DateTime, Float, ForeignKey, Index, Integer,
                        Numeric, String, Text, UniqueConstraint)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

JsonType = JSON().with_variant(JSONB(), "postgresql")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---- enumerations (stored as strings, validated in schemas/services) ----
ROLES = ("ADMIN", "OWNER", "FAMILY", "INSURANCE")
ACCIDENT_STATUSES = ("DETECTED", "CANCELLED", "EMERGENCY_DISPATCHED", "RESOLVED", "FALSE_ALARM")
CANCELLATION_STATUSES = ("NONE", "REQUESTED", "CANCELLED")
CLAIM_STATUSES = ("NOT_INITIATED", "SUBMITTED", "IN_PROGRESS", "APPROVED", "REJECTED", "SETTLED")
DELIVERY_STATUSES = ("PENDING", "SUBMITTED", "DELIVERED", "FAILED", "UNKNOWN")


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(20))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), index=True)
    # Insurance staff only see vehicles whose insurance_company matches this value.
    organization: Mapped[str | None] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class Vehicle(Base):
    __tablename__ = "vehicles"
    id: Mapped[int] = mapped_column(primary_key=True)
    vehicle_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    vehicle_model: Mapped[str | None] = mapped_column(String(80))
    vehicle_type: Mapped[str | None] = mapped_column(String(40))
    insurance_policy_number: Mapped[str | None] = mapped_column(String(60))
    insurance_company: Mapped[str | None] = mapped_column(String(120), index=True)
    insurance_expiry_date: Mapped[date | None] = mapped_column(Date)
    device_id: Mapped[str | None] = mapped_column(String(40), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    owner: Mapped[User] = relationship()


class FamilyAccess(Base):
    """Explicit sharing: a FAMILY user only sees vehicles listed here."""
    __tablename__ = "family_access"
    id: Mapped[int] = mapped_column(primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (UniqueConstraint("vehicle_id", "user_id", name="uq_family_vehicle_user"),)


class Device(Base):
    __tablename__ = "devices"
    id: Mapped[int] = mapped_column(primary_key=True)
    device_id: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    vehicle_id: Mapped[int | None] = mapped_column(ForeignKey("vehicles.id"), unique=True)
    device_key_hash: Mapped[str] = mapped_column(String(128))
    device_status: Mapped[str] = mapped_column(String(20), default="ACTIVE")  # ACTIVE | DISABLED
    firmware_version: Mapped[str | None] = mapped_column(String(40))
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    vehicle: Mapped[Vehicle | None] = relationship()


class Accident(Base):
    __tablename__ = "accidents"
    id: Mapped[int] = mapped_column(primary_key=True)
    accident_id: Mapped[str] = mapped_column(String(48), unique=True, index=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    gps_valid: Mapped[bool] = mapped_column(Boolean, default=False)
    acceleration_g: Mapped[float | None] = mapped_column(Float)
    gyroscope_data: Mapped[dict | None] = mapped_column(JsonType)
    accident_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    accident_status: Mapped[str] = mapped_column(String(30), default="DETECTED", index=True)
    cancellation_status: Mapped[str] = mapped_column(String(20), default="NONE")
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    vehicle: Mapped[Vehicle] = relationship()
    owner: Mapped[User] = relationship()
    claim: Mapped["InsuranceClaim | None"] = relationship(back_populates="accident", uselist=False)


class InsuranceClaim(Base):
    __tablename__ = "insurance_claims"
    id: Mapped[int] = mapped_column(primary_key=True)
    claim_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    accident_id: Mapped[int] = mapped_column(ForeignKey("accidents.id"), unique=True)  # one claim per accident
    policy_number: Mapped[str | None] = mapped_column(String(60))
    insurance_company: Mapped[str | None] = mapped_column(String(120))
    claim_amount: Mapped[float | None] = mapped_column(Numeric(12, 2))
    claim_status: Mapped[str] = mapped_column(String(20), default="SUBMITTED", index=True)
    claim_description: Mapped[str | None] = mapped_column(Text)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    review_remarks: Mapped[str | None] = mapped_column(Text)
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    accident: Mapped[Accident] = relationship(back_populates="claim")
    reviewer: Mapped[User | None] = relationship()


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    accident_id: Mapped[int] = mapped_column(ForeignKey("accidents.id"), index=True)
    recipient_type: Mapped[str] = mapped_column(String(20))      # FAMILY | INSURANCE | EMERGENCY
    recipient_phone: Mapped[str] = mapped_column(String(20))
    notification_type: Mapped[str] = mapped_column(String(10))   # SMS | CALL
    message: Mapped[str | None] = mapped_column(Text)
    delivery_status: Mapped[str] = mapped_column(String(12), default="PENDING", index=True)
    modem_response: Mapped[str | None] = mapped_column(Text)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    retry_requested: Mapped[bool] = mapped_column(Boolean, default=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    accident: Mapped[Accident] = relationship()
    __table_args__ = (UniqueConstraint("accident_id", "recipient_type", "recipient_phone",
                                       "notification_type", name="uq_notification_target"),)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(60), index=True)
    entity_type: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[str] = mapped_column(String(60))
    previous_value: Mapped[dict | None] = mapped_column(JsonType)
    new_value: Mapped[dict | None] = mapped_column(JsonType)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    user: Mapped[User | None] = relationship()
    __table_args__ = (Index("ix_audit_entity", "entity_type", "entity_id"),)


class RefreshToken(Base):
    """Server-side record of issued refresh tokens, enabling rotation + reuse detection."""
    __tablename__ = "refresh_tokens"
    id: Mapped[int] = mapped_column(primary_key=True)
    jti: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
