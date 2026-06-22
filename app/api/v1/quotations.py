"""
BritLedger AI — Quotations Router
GET    /quotations
POST   /quotations
GET    /quotations/{id}
PUT    /quotations/{id}
POST   /quotations/{id}/send
POST   /quotations/{id}/convert
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import PaginationParams, get_current_user
from app.models.quotation import QuotationStatus
from app.models.user import User
from app.schemas.common import APIResponse, PaginatedResponse
from app.schemas.invoice import InvoiceResponse
from app.schemas.quotation import (
    ConvertToInvoiceRequest,
    QuotationCreate,
    QuotationResponse,
    QuotationUpdate,
)
from app.services.quotation_service import QuotationService

router = APIRouter(prefix="/quotations", tags=["Quotations"])


@router.post(
    "",
    response_model=APIResponse[QuotationResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a new quotation",
)
async def create_quotation(
    payload: QuotationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = QuotationService(db, current_user.id)
    data = await svc.create(payload)
    return APIResponse(message="Quotation created.", data=data)


@router.get(
    "",
    response_model=PaginatedResponse[QuotationResponse],
    summary="List quotations with filters",
)
async def list_quotations(
    pagination: PaginationParams = Depends(),
    quot_status: Optional[QuotationStatus] = Query(None, alias="status"),
    client_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = QuotationService(db, current_user.id)
    return await svc.list_quotations(
        page=pagination.page,
        page_size=pagination.page_size,
        status_filter=quot_status,
        client_id=client_id,
    )


@router.get(
    "/{quotation_id}",
    response_model=APIResponse[QuotationResponse],
    summary="Get quotation by ID",
)
async def get_quotation(
    quotation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = QuotationService(db, current_user.id)
    data = await svc.get_by_id(quotation_id)
    return APIResponse(data=data)


@router.put(
    "/{quotation_id}",
    response_model=APIResponse[QuotationResponse],
    summary="Update a draft quotation",
)
async def update_quotation(
    quotation_id: str,
    payload: QuotationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = QuotationService(db, current_user.id)
    data = await svc.update(quotation_id, payload)
    return APIResponse(message="Quotation updated.", data=data)


@router.post(
    "/{quotation_id}/send",
    response_model=APIResponse[QuotationResponse],
    summary="Send quotation to client",
)
async def send_quotation(
    quotation_id: str,
    payload: Optional[dict] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = QuotationService(db, current_user.id)
    data = await svc.send_quotation(quotation_id, payload)
    return APIResponse(message="Quotation sent.", data=data)


@router.post(
    "/{quotation_id}/convert",
    response_model=APIResponse[dict],
    status_code=status.HTTP_201_CREATED,
    summary="Convert quotation to invoice",
)
async def convert_to_invoice(
    quotation_id: str,
    payload: ConvertToInvoiceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = QuotationService(db, current_user.id)
    invoice_id = await svc.convert_to_invoice(quotation_id, payload)
    return APIResponse(
        message="Quotation converted to invoice.",
        data={"invoice_id": invoice_id},
    )
