from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete as sa_delete
from pydantic import BaseModel, EmailStr
from app.core.database import get_db
from app.dependencies import get_current_user, get_admin_user
from app.models.user import User
from app.schemas.user import UserUpdate
from app.schemas.common import APIResponse
from app.models.client import Client
from app.models.invoice import Invoice
from app.models.quotation import Quotation
from app.models.notification import Notification
from app.models.payment import PaymentSettings, PaymentTransaction
from typing import List, Optional

class SeedAdminRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = "Super Admin"
    role: Optional[str] = "SUPERADMIN"

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.post("/seed", response_model=APIResponse)
async def seed_admin(payload: SeedAdminRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalars().first()
    if user:
        from app.core.security import get_password_hash, verify_password
        updated = False
        if not verify_password(payload.password, user.hashed_password):
            user.hashed_password = get_password_hash(payload.password)
            updated = True
        if user.role != "SUPERADMIN" or not user.is_active:
            user.role = "SUPERADMIN"
            user.is_active = True
            updated = True
        if payload.full_name and user.full_name != payload.full_name:
            user.full_name = payload.full_name
            updated = True
        if updated:
            await db.commit()
            return APIResponse(message="Admin user updated with correct password hash and role")
        return APIResponse(message="Admin user already exists")

    from app.core.security import get_password_hash
    new_user = User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        is_active=True,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return APIResponse(message="Admin user created successfully", data={"id": new_user.id})

@router.get("/users", response_model=APIResponse[List[dict]])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return APIResponse(data=[
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role.value if u.role else None,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ])

@router.patch("/users/{user_id}", response_model=APIResponse)
async def update_user(
    user_id: str,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = payload.dict(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        from app.core.security import get_password_hash
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    elif "password" in update_data:
        update_data.pop("password")

    for key, value in update_data.items():
        setattr(user, key, value)

    await db.commit()
    await db.refresh(user)
    return APIResponse(message="User updated successfully")

@router.delete("/users/{user_id}", response_model=APIResponse)
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    from sqlalchemy import delete as sa_delete

    await db.execute(sa_delete(PaymentTransaction).where(PaymentTransaction.user_id == user_id))
    await db.execute(sa_delete(PaymentSettings).where(PaymentSettings.user_id == user_id))
    await db.execute(sa_delete(Notification).where(Notification.user_id == user_id))
    invoice_ids = await db.execute(select(Invoice.id).where(Invoice.user_id == user_id))
    invoice_id_list = [row[0] for row in invoice_ids.fetchall()]
    for inv_id in invoice_id_list:
        await db.execute(sa_delete(PaymentTransaction).where(PaymentTransaction.invoice_id == inv_id))
    await db.execute(sa_delete(Invoice).where(Invoice.user_id == user_id))
    await db.execute(sa_delete(Quotation).where(Quotation.user_id == user_id))
    await db.execute(sa_delete(Client).where(Client.user_id == user_id))
    await db.execute(sa_delete(User).where(User.id == user_id))
    await db.commit()

    return APIResponse(message="User and all associated data deleted successfully")
