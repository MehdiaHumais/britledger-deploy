from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.user import User as UserSchema, UserUpdate
from app.schemas.common import APIResponse

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/me", response_model=APIResponse[UserSchema])
async def get_me(current_user: User = Depends(get_current_user)):
    return APIResponse(data=current_user)

@router.patch("/me", response_model=APIResponse[UserSchema])
async def update_me(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if user_update.email is not None:
        current_user.email = user_update.email
    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name
    if user_update.avatar is not None:
        current_user.avatar = user_update.avatar
    
    # In a real app, you would handle password hashing here
    # if user_update.password:
    #     current_user.hashed_password = get_password_hash(user_update.password)
    
    await db.commit()
    await db.refresh(current_user)
    return APIResponse(data=current_user, message="Profile updated successfully")
