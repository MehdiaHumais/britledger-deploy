from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import base64
import re
from app.core.database import get_db
from app.core.security import get_password_hash
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
    if user_update.company_name is not None:
        current_user.company_name = user_update.company_name
    if user_update.vat_number is not None:
        current_user.vat_number = user_update.vat_number
    if user_update.address is not None:
        current_user.address = user_update.address
    if user_update.email_notifications is not None:
        current_user.email_notifications = user_update.email_notifications
    if user_update.ai_notifications is not None:
        current_user.ai_notifications = user_update.ai_notifications
    if user_update.password:
        current_user.hashed_password = get_password_hash(user_update.password)
    
    await db.commit()
    await db.refresh(current_user)
    return APIResponse(data=current_user, message="Profile updated successfully")

@router.get("/{user_id}/avatar", include_in_schema=False)
async def get_user_avatar(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user or not user.avatar:
        raise HTTPException(status_code=404, detail="Avatar not found")
    data = user.avatar
    media_type = "image/png"
    if data.startswith("data:"):
        header, _, b64 = data.partition(",")
        mime = re.search(r"data:([^;]+)", header)
        if mime:
            media_type = mime.group(1)
    else:
        b64 = data
    try:
        raw = base64.b64decode(b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid avatar data")
    return Response(content=raw, media_type=media_type)
