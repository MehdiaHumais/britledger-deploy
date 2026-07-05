from typing import List, Union, Optional
from pydantic import AnyHttpUrl, validator, Field
from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    APP_NAME: str = "BritLedger AI"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    APP_VERSION: str = "1.0.0"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    API_PREFIX: str = "/api/v1"

    # Security
    SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_RESET_TOKEN_EXPIRE_MINUTES: int = 15

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:8000"

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    # Supabase
    SUPABASE_URL: str | None = None
    SUPABASE_ANON_KEY: str | None = None
    SUPABASE_DATABASE_URL_RAW: str = Field(alias="SUPABASE_DATABASE_URL", default="")

    @property
    def database_url(self) -> str:
        """Use Supabase if URL is set, otherwise fall back to SQLite for development"""
        supabase_url = self.SUPABASE_DATABASE_URL
        if not supabase_url:
            db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "britledger_dev.db")
            return f"sqlite+aiosqlite:///{db_path}"
        return supabase_url

    @property
    def SUPABASE_DATABASE_URL(self) -> str:
        """Async URL for FastAPI/asyncpg"""
        url = self.SUPABASE_DATABASE_URL_RAW
        return url

    @property
    def sync_database_url(self) -> str:
        """Sync URL for Alembic/psycopg2 - must be clean of asyncpg params"""
        url = self.SUPABASE_DATABASE_URL_RAW.replace("postgresql+asyncpg://", "postgresql://")
        if "ssl=require" in url:
            url = url.replace("ssl=require", "sslmode=require")
        elif "sslmode=" not in url:
            separator = "&" if "?" in url else "?"
            url = f"{url}{separator}sslmode=require"
        return url

    # Redis
    REDIS_URL: str
    CACHE_TTL_SECONDS: int = 300

    # Payment Gateways (Stripe & PayPal)
    STRIPE_SECRET_KEY: str | None = None
    STRIPE_WEBHOOK_SECRET: str | None = None
    STRIPE_CLIENT_ID: str | None = None
    STRIPE_CONNECT_REDIRECT_URI: str = "http://localhost:3000/settings?tab=payments&stripe=callback"
    PAYPAL_CLIENT_ID: str | None = None
    PAYPAL_CLIENT_SECRET: str | None = None
    PAYPAL_BASE_URL: str = "https://api-m.sandbox.paypal.com"
    PAYPAL_MODE: str = "sandbox"

    # AI & Email Services
    OPENAI_API_KEY: Optional[str] = None
    AI_MODEL: str = "gpt-4"
    EMAIL_API_KEY: Optional[str] = None

    # Sentry
    SENTRY_DSN: Optional[str] = None
    SENTRY_ENVIRONMENT: str = "development"
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1
    
    # Company Info (UK)
    COMPANY_NAME: str = "BritLedger AI"
    COMPANY_ADDRESS: Optional[str] = None
    COMPANY_VAT_NUMBER: Optional[str] = None
    SENDER_EMAIL: Optional[str] = None

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

settings = Settings()
