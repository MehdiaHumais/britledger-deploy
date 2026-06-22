from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    User as UserSchema,
)
from app.schemas.common import APIResponse

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=APIResponse, status_code=201)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user. Returns 422 if validation fails, 409 if email taken."""
    # Check email uniqueness
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    full_name = f"{payload.first_name} {payload.last_name}".strip()
    user = User(
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
            detail="Account is disabled. Please contact support.",
        )

    token = create_access_token(subject=user.id)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=APIResponse[UserSchema])
async def get_me(current_user: User = Depends(get_current_user)):
    return APIResponse(data=current_user)
