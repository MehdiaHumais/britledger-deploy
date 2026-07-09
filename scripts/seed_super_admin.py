"""
Run this script ONCE to create the super admin user in PostgreSQL.
Usage: python scripts/seed_super_admin.py

Or from project root: python -m scripts.seed_super_admin
"""
import asyncio
import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_db, engine
from app.models.user import User
from app.core.security import get_password_hash
from sqlalchemy import select


ADMIN_EMAIL = "britsyncuk@gmail.com"
ADMIN_PASSWORD = "superadmin123"
ADMIN_NAME = "Super Admin"
ADMIN_ROLE = "SUPERADMIN"


async def seed():
    async with engine.begin() as conn:
        from sqlalchemy import text
        result = await conn.execute(text(f"SELECT id FROM users WHERE email = '{ADMIN_EMAIL}'"))
        existing = result.fetchone()
        if existing:
            print(f"Admin user already exists (id: {existing[0]})")
            return

    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        hashed = get_password_hash(ADMIN_PASSWORD)
        user = User(
            email=ADMIN_EMAIL,
            hashed_password=hashed,
            full_name=ADMIN_NAME,
            role=ADMIN_ROLE,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        print(f"Super admin created successfully (id: {user.id})")


if __name__ == "__main__":
    asyncio.run(seed())
