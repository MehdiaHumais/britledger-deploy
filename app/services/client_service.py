from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.client import Client
from app.schemas.client import ClientCreate, ClientUpdate, ClientBalances
from fastapi import HTTPException, status
from uuid import UUID

class ClientService:
    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db = db
        self.user_id = user_id

    async def create(self, payload: ClientCreate) -> Client:
        client = Client(**payload.dict(), user_id=self.user_id)
        self.db.add(client)
        await self.db.commit()
        await self.db.refresh(client)
        return client

    async def get_by_id(self, client_id: str) -> Client:
        result = await self.db.execute(select(Client).where(Client.id == client_id, Client.user_id == self.user_id))
        client = result.scalars().first()
        if not client:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
        return client

    async def update(self, client_id: str, payload: ClientUpdate) -> Client:
        client = await self.get_by_id(client_id)
        update_data = payload.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(client, key, value)
        await self.db.commit()
        await self.db.refresh(client)
        return client

    async def delete(self, client_id: str):
        client = await self.get_by_id(client_id)
        client.is_active = False
        await self.db.commit()

    async def get_balances(self, client_id: str) -> ClientBalances:
        # Placeholder for actual balance calculation logic from invoices/payments
        return ClientBalances(
            client_id=UUID(client_id),
            total_invoiced=0.0,
            total_paid=0.0,
            outstanding_balance=0.0
        )

    async def list_clients(self, page: int, page_size: int, search: str = None, is_active: bool = None):
        query = select(Client).where(Client.user_id == self.user_id)
        if search:
            query = query.where(Client.name.ilike(f"%{search}%") | Client.email.ilike(f"%{search}%"))
        if is_active is not None:
            query = query.where(Client.is_active == is_active)
            
        # Count total
        from sqlalchemy import func
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_query)).scalar() or 0
        
        # Paginate
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(query)
        clients = result.scalars().all()
        
        return {
            "success": True,
            "data": clients,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if total else 0
        }
