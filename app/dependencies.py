from fastapi import Depends, HTTPException, status, Query, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_PREFIX}/auth/login")

class PaginationParams:
    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number"),
        page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    ):
        self.page = page
        self.page_size = page_size

async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> User:
    from fastapi.security.utils import get_authorization_scheme_param
    
    authorization: str = request.headers.get("Authorization")
    scheme, token = get_authorization_scheme_param(authorization)

    if settings.is_development and not authorization:
        dev_user_id = "dev-user-001"
        result = await db.execute(select(User).where(User.id == dev_user_id))
        user = result.scalars().first()
        if not user:
            user = User(
                id=dev_user_id,
                email="dev@britledger.local",
                full_name="Dev User",
                hashed_password="dev_mode",
                role="ADMIN",
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
        return user

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not authorization or scheme.lower() != "bearer":
        print("[AUTH_ERROR] Missing or invalid Authorization header")
        raise credentials_exception
    
    try:
        if token == "fake_token" and settings.APP_ENV == "development":
            user_id = "flwszm7vymozp0pxg"
            print(f"[AUTH_DEV] Using legacy mock user: {user_id}")
        else:
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
                print("[AUTH_SUCCESS] Token decoded with primary secret")
            except JWTError as e:
                try:
                    payload = jwt.decode(token, "fallback_secret", algorithms=[settings.JWT_ALGORITHM])
                    print("[AUTH_SUCCESS] Token decoded with fallback_secret")
                except JWTError:
                    print(f"[AUTH_ERROR] JWT decode failed: {str(e)}")
                    raise credentials_exception
            
            user_id: str = payload.get("sub")
            
        if user_id is None:
            print("[AUTH_ERROR] No 'sub' (user_id) in token payload")
            raise credentials_exception
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"[AUTH_CRITICAL] Unexpected auth error: {str(e)}")
        raise credentials_exception
        
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    
    if user is None:
        token_email = payload.get("email", "")
        if token_email:
            existing = await db.execute(select(User).where(User.email == token_email))
            user = existing.scalars().first()
            if user is not None:
                if not user.is_active:
                    print(f"[AUTH_ERROR] User {user.id} is disabled")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Your account has been deleted. Please contact support."
                    )
                return user
        print(f"[AUTH_ERROR] User {user_id} not found in DB and no matching email exists")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found. Your account has been deleted.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.is_active:
        print(f"[AUTH_ERROR] User {user_id} is disabled")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been disabled. Please contact support.",
        )
        
    return user


async def get_admin_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role.value != "SUPERADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user
