"""
BritLedger AI — Clients Router
GET    /clients
POST   /clients
GET    /clients/{id}
PUT    /clients/{id}
DELETE /clients/{id}
GET    /clients/{id}/balances
GET    /clients/{id}/invoices
GET    /clients/{id}/payments
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import PaginationParams, get_current_user
from app.models.user import User
from app.schemas.client import ClientBalances, ClientCreate, ClientResponse, ClientUpdate
from app.schemas.common import APIResponse, PaginatedResponse
from app.services.client_service import ClientService

router = APIRouter(prefix="/clients", tags=["Clients"])


@router.post(
    "",
    response_model=APIResponse[ClientResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a new client",
)
async def create_client(
    payload: ClientCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ClientService(db, current_user.id)
    data = await svc.create(payload)
    return APIResponse(message="Client created.", data=data)


@router.get(
    "",
    response_model=PaginatedResponse[ClientResponse],
    summary="List clients with search and filters",
)
async def list_clients(
    pagination: PaginationParams = Depends(),
    search: Optional[str] = Query(None, description="Search by name or email"),
    is_active: Optional[bool] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ClientService(db, current_user.id)
    return await svc.list_clients(
        page=pagination.page,
        page_size=pagination.page_size,
        search=search,
        is_active=is_active,
    )


@router.get(
    "/{client_id}",
    response_model=APIResponse[ClientResponse],
    summary="Get client by ID",
)
async def get_client(
    client_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ClientService(db, current_user.id)
    client = await svc.get_by_id(client_id)
    return APIResponse(data=ClientResponse.model_validate(client))


@router.put(
    "/{client_id}",
    response_model=APIResponse[ClientResponse],
    summary="Update client",
)
async def update_client(
    client_id: str,
    payload: ClientUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ClientService(db, current_user.id)
    updated = await svc.update(client_id, payload)
    return APIResponse(message="Client updated.", data=updated)


@router.delete(
    "/{client_id}",
    response_model=APIResponse,
    summary="Deactivate a client (soft delete)",
)
async def delete_client(
    client_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ClientService(db, current_user.id)
    await svc.delete(client_id)
    return APIResponse(message="Client deactivated.")


@router.get(
    "/{client_id}/balances",
    response_model=APIResponse[ClientBalances],
    summary="Get client outstanding balance summary",
)
async def get_client_balances(
    client_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ClientService(db, current_user.id)
    balances = await svc.get_balances(client_id)
    return APIResponse(data=balances)


@router.get(
    "/{client_id}/invoices",
    response_model=PaginatedResponse,
    summary="Get invoice history for a client",
)
async def get_client_invoices(
    client_id: str,
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.invoice_service import InvoiceService
    svc = InvoiceService(db, current_user.id)
    return await svc.list_invoices(
        page=pagination.page,
        page_size=pagination.page_size,
        client_id=client_id,
    )
