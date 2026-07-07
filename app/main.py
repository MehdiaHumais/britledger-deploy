"""
BritLedger AI — Main FastAPI Application Entry Point
"""

from __future__ import annotations

import time
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import sentry_sdk
from fastapi import FastAPI, Request, status, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from jose import JWTError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import get_logger, setup_logging
from app.core.redis import close_redis, get_redis
from app.middleware.logging import RequestLoggingMiddleware
from app.middleware.security import SecurityHeadersMiddleware

# ── Setup ─────────────────────────────────────────────────
setup_logging()
logger = get_logger(__name__)

# ── Sentry Error Monitoring ────────────────────────────────
if settings.SENTRY_DSN and settings.is_production:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.SENTRY_ENVIRONMENT,
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
    )

# ── Rate Limiter ──────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])


# ── Lifespan (startup / shutdown) ─────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """Startup and shutdown logic."""
    logger.info("britledger_startup", version=settings.APP_VERSION, env=settings.APP_ENV)

    # Test Redis connection (with timeout to avoid hanging)
    try:
        redis = await get_redis()
        await asyncio.wait_for(redis.ping(), timeout=3.0)
        logger.info("redis_connected")
    except Exception as e:
        logger.warning("redis_unavailable", error=str(e))

    # Create tables for SQLite dev (no-op for production)
    try:
        from app.core.database import engine, Base
        import app.models  # noqa: ensure all models are registered with Base
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("database_tables_ready")
    except Exception as e:
        logger.warning("database_tables_error", error=str(e))

    yield

    logger.info("britledger_shutdown")
    await close_redis()


# ── Application Factory ────────────────────────────────────
def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        description=(
            "Production-ready AI Bookkeeping & Invoicing API. "
            "Built for UK businesses with full VAT, recurring invoices, "
            "quotations, and comprehensive financial reporting."
        ),
        version=settings.APP_VERSION,
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        openapi_url=f"{settings.API_PREFIX}/openapi.json",
        lifespan=lifespan,
    )

    # ── Middleware Stack ──
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        return response

    allowed_origins = [
        "https://ledger.britsyncai.com",
        str(settings.FRONTEND_URL),
        "capacitor://localhost",
        "https://localhost",
        "http://localhost",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    if settings.is_development:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    else:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=allowed_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # ── Rate limiter state ────────────────────────────────
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # ── Routers ───────────────────────────────────────────
    app.include_router(api_router, prefix=settings.API_PREFIX)

    # ── Exception Handlers ────────────────────────────────
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        errors = []
        for error in exc.errors():
            field = " → ".join(str(loc) for loc in error["loc"])
            errors.append({"field": field, "message": error["msg"]})
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "success": False,
                "message": "Validation error.",
                "errors": errors,
            },
        )

    @app.exception_handler(JWTError)
    async def jwt_exception_handler(
        request: Request, exc: JWTError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"success": False, "message": str(exc)},
        )

    @app.exception_handler(Exception)
    async def global_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        logger.error(
            "unhandled_exception",
            path=request.url.path,
            error=str(exc),
            exc_info=True,
        )
        if settings.is_development:
            detail = str(exc)
        else:
            detail = "An internal server error occurred."
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"success": False, "message": detail},
            headers={"Access-Control-Allow-Origin": "*"} if settings.is_development else {},
        )

    # ── Health & Root Endpoints ───────────────────────────
    @app.get("/health", tags=["System"], include_in_schema=False)
    async def health_check():
        return {
            "status": "healthy",
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "environment": settings.APP_ENV,
            "timestamp": time.time(),
        }

    @app.get("/", tags=["System"], include_in_schema=False)
    async def root():
        return {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "docs": "/docs",
            "health": "/health",
        }

    return app


app = create_app()
