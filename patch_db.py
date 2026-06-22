import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def patch_db():
    print("🚀 Patching database...")
    async with AsyncSessionLocal() as session:
        try:
            # Add stripe_account_id column to payment_settings
            await session.execute(text("ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(100)"))
            await session.commit()
            print("✅ Database patched successfully!")
        except Exception as e:
            print(f"❌ Error patching database: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(patch_db())
