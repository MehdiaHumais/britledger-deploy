from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import uuid4
import asyncio

from app.core.database import get_db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_password_reset_token,
    verify_password_reset_token,
)
from app.dependencies import get_current_user
from app.models.user import User
from app.services.email_service import EmailService
from app.schemas.user import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    User as UserSchema,
    FingerprintRegisterRequest,
    FingerprintLoginRequest,
    FingerprintUpgradeRequest,
)
from app.schemas.common import APIResponse

FINGERPRINT_DOMAIN = "@fingerprint.local"

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=APIResponse, status_code=201)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user. Returns 422 if validation fails, 409 if email taken."""
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    full_name = f"{payload.first_name} {payload.last_name}".strip()
    user = User(
        id=payload.id or str(uuid4()),
        email=payload.email,
        full_name=full_name,
        hashed_password=get_password_hash(payload.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(subject=user.id)
    return APIResponse(
        data={"access_token": token, "token_type": "bearer", "user_id": user.id}
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with email + password. Returns 401 if credentials are invalid."""
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalars().first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been disabled. Please contact support.",
        )

    token = create_access_token(subject=user.id)
    return TokenResponse(access_token=token)


@router.post("/fingerprint/register", response_model=APIResponse)
async def fingerprint_register(payload: FingerprintRegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user with a device fingerprint (no password needed)."""
    fake_email = f"{payload.device_id}{FINGERPRINT_DOMAIN}"
    result = await db.execute(select(User).where(User.email == fake_email))
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This device is already registered. Please log in with fingerprint.",
        )

    import uuid
    user = User(
        email=fake_email,
        full_name=payload.name,
        hashed_password=get_password_hash(str(uuid.uuid4())),
        device_id=payload.device_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(subject=user.id)
    return APIResponse(
        data={"access_token": token, "token_type": "bearer", "user_id": user.id, "is_fingerprint": True}
    )


@router.post("/fingerprint/login", response_model=TokenResponse)
async def fingerprint_login(payload: FingerprintLoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with a device fingerprint."""
    fake_email = f"{payload.device_id}{FINGERPRINT_DOMAIN}"
    result = await db.execute(select(User).where(User.email == fake_email))
    user = result.scalars().first()

    if not user:
        result = await db.execute(select(User).where(User.device_id == payload.device_id))
        user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No fingerprint account found on this device. Please register first.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been disabled. Please contact support.",
        )

    token = create_access_token(subject=user.id)
    return TokenResponse(access_token=token)


@router.post("/fingerprint/upgrade", response_model=APIResponse)
async def fingerprint_upgrade(
    payload: FingerprintUpgradeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add email + password to a fingerprint-only account as backup."""
    if not current_user.email.endswith(FINGERPRINT_DOMAIN):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account already has email/password credentials.",
        )

    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email is already in use.",
        )

    current_user.email = payload.email
    current_user.hashed_password = get_password_hash(payload.password)
    await db.commit()
    await db.refresh(current_user)

    return APIResponse(message="Account upgraded with email and password successfully.")


@router.get("/me", response_model=APIResponse[UserSchema])
async def get_me(current_user: User = Depends(get_current_user)):
    user_data = UserSchema.model_validate(current_user)
    user_data.is_fingerprint = current_user.email.endswith(FINGERPRINT_DOMAIN)
    user_data.role = current_user.role.value if current_user.role else None
    return APIResponse(data=user_data)


@router.get("/check-email")
async def check_email(email: str, db: AsyncSession = Depends(get_db)):
    """Check if an email is already taken (used by the register page to block re-use)."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    return APIResponse(data={"exists": user is not None})


@router.post("/forgot-password", response_model=APIResponse)
async def forgot_password(payload: dict, db: AsyncSession = Depends(get_db)):
    """Send a password reset link to the given email if an account exists."""
    email = (payload.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is required.")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    # Always report success to avoid leaking which emails have accounts.
    if not user:
        return APIResponse(message="If that email exists, a reset link has been sent.")

    token = create_password_reset_token(subject=user.id)
    email_svc = EmailService()
    _, error = await asyncio.to_thread(
        email_svc.send_password_reset_email, to_email=user.email, reset_token=token
    )
    if error:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to send reset email: {error}")

    return APIResponse(message="If that email exists, a reset link has been sent.")


@router.post("/reset-password", response_model=APIResponse)
async def reset_password(payload: dict, db: AsyncSession = Depends(get_db)):
    """Reset the password using a token from the reset email."""
    token = payload.get("token") or ""
    new_password = payload.get("new_password") or ""

    if not token or not new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token and new password are required.")
    if len(new_password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 6 characters.")

    user_id = verify_password_reset_token(token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset link is invalid or has expired. Please request a new one.",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found.")

    user.hashed_password = get_password_hash(new_password)
    await db.commit()
    await db.refresh(user)
    return APIResponse(message="Your password has been reset successfully. Please log in.")
