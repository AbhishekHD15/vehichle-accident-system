"""Environment based configuration. No secrets live in source code."""
import os
from dotenv import load_dotenv

load_dotenv()


def _bool(name: str, default: str) -> bool:
    return os.getenv(name, default).strip().lower() in ("1", "true", "yes", "on")


class Settings:
    APP_ENV = os.getenv("APP_ENV", "development")
    DATABASE_URL = os.getenv(
        "DATABASE_URL", "postgresql+psycopg2://postgres:postgres@localhost:5432/accident_db"
    )
    JWT_SECRET = os.getenv("JWT_SECRET", "")
    JWT_ALGORITHM = "HS256"
    ACCESS_TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "15"))
    REFRESH_TOKEN_DAYS = int(os.getenv("REFRESH_TOKEN_DAYS", "7"))
    CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
    ENABLE_DOCS = _bool("ENABLE_DOCS", "true")
    RATE_LIMIT_ENABLED = _bool("RATE_LIMIT_ENABLED", "true")
    LOGIN_RATE_LIMIT = os.getenv("LOGIN_RATE_LIMIT", "10/minute")
    DEVICE_RATE_LIMIT = os.getenv("DEVICE_RATE_LIMIT", "60/minute")
    DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "5"))
    DB_MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "10"))
    MAX_NOTIFICATION_RETRIES = int(os.getenv("MAX_NOTIFICATION_RETRIES", "5"))
    DEVICE_ONLINE_SECONDS = int(os.getenv("DEVICE_ONLINE_SECONDS", "300"))
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"


settings = Settings()

if not settings.JWT_SECRET:
    if settings.is_production:
        raise RuntimeError("JWT_SECRET must be set in production")
    # Development convenience only. Never used in production (guarded above).
    settings.JWT_SECRET = "dev-only-insecure-secret-change-me-0123456789"
