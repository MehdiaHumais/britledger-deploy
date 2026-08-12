"""
BritLedger AI — Invoices Router
GET    /invoices
POST   /invoices
GET    /invoices/{id}
PUT    /invoices/{id}
DELETE /invoices/{id}
POST   /invoices/{id}/send
POST   /invoices/{id}/cancel
POST   /invoices/{id}/payments
POST   /invoices/export/pdf  (no auth required — uses local data from frontend)
"""

import time
import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status, Response, Body
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import PaginationParams, get_current_user
from app.models.invoice import InvoiceStatus
from app.models.user import User
from app.schemas.common import APIResponse, PaginatedResponse
from app.schemas.finance import PaymentCreate, PaymentResponse
from app.schemas.invoice import (
    InvoiceCreate,
    InvoiceResponse,
    InvoiceUpdate,
    SendInvoiceRequest,
)
from app.services.invoice_service import InvoiceService
from app.services.pdf_service import PDFService

router = APIRouter(prefix="/invoices", tags=["Invoices"])

# In-memory cache for generated PDFs (token -> {bytes, filename, expires})
# Used so the client can trigger the download from a real URL (browser/IDM friendly).
_pdf_cache: dict[str, dict] = {}
_pdf_ttl = 300


# ── IMPORTANT: /export/pdf MUST be declared before /{invoice_id} routes ──────
# Otherwise FastAPI matches "export" as an invoice_id, causing 404/422 errors.
@router.post(
    "/export/pdf",
    summary="Generate invoice PDF from raw data (no auth required)",
)
async def export_invoice_pdf_raw(
    payload: dict = Body(...),
):
    """
    Accepts raw invoice data from the frontend local-db and returns a PDF.
    Authentication is NOT required — the PDF is generated from the payload alone,
    with a generic company identity since no real user session exists.
    """
    # Build a lightweight mock user so PDFService doesn't crash
    class _MockUser:
        company_name = payload.get("company_name") or "BritLedger AI"
        email = payload.get("company_email") or ""
        address = payload.get("company_address") or ""
        vat_number = payload.get("vat_number") or ""
        name = company_name
        full_name = company_name

    pdf_bytes = PDFService.generate_invoice_pdf(payload, _MockUser())

    invoice_number = payload.get("invoice_number") or payload.get("number") or "draft"
    filename = f"invoice_{invoice_number}.pdf"
    token = uuid.uuid4().hex
    _pdf_cache[token] = {
        "bytes": pdf_bytes,
        "filename": filename,
        "expires": time.time() + _pdf_ttl,
    }
    return JSONResponse(
        {
            "success": True,
            "message": "PDF generated.",
            "data": {"token": token, "filename": filename},
        }
    )


@router.get(
    "/export/pdf/{token}",
    summary="Download a previously generated invoice PDF by token",
)
async def download_invoice_pdf(token: str):
    """
    Serves the generated PDF from the in-memory cache. The token acts as a
    short-lived, unguessable capability so a plain browser/IDM download can be
    triggered from a real URL without any Authorization header.
    """
    entry = _pdf_cache.get(token)
    if not entry or entry["expires"] < time.time():
        _pdf_cache.pop(token, None)
        raise HTTPException(status_code=404, detail="Download link expired or invalid.")
    return Response(
        content=entry["bytes"],
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{entry["filename"]}"'},
    )


@router.post(
    "",
    response_model=APIResponse[InvoiceResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a new invoice",
)
async def create_invoice(
    payload: InvoiceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = InvoiceService(db, current_user.id)
    data = await svc.create(payload)
    return APIResponse(message="Invoice created.", data=data)


@router.get(
    "",
    response_model=PaginatedResponse[InvoiceResponse],
    summary="List invoices with filtering and pagination",
)
async def list_invoices(
    pagination: PaginationParams = Depends(),
    invoice_status: Optional[InvoiceStatus] = Query(None, alias="status"),
    client_id: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    search: Optional[str] = Query(None, description="Search by invoice number or reference"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = InvoiceService(db, current_user.id)
    return await svc.list_invoices(
        page=pagination.page,
        page_size=pagination.page_size,
        status_filter=invoice_status,
        client_id=client_id,
        date_from=date_from,
        date_to=date_to,
        search=search,
    )


@router.get(
    "/{invoice_id}",
    response_model=APIResponse[InvoiceResponse],
    summary="Get invoice details with line items",
)
async def get_invoice(
    invoice_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = InvoiceService(db, current_user.id)
    data = await svc.get_by_id(invoice_id)
    return APIResponse(data=data)


@router.put(
    "/{invoice_id}",
    response_model=APIResponse[InvoiceResponse],
    summary="Update a draft or sent invoice",
)
async def update_invoice(
    invoice_id: str,
    payload: InvoiceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = InvoiceService(db, current_user.id)
    data = await svc.update(invoice_id, payload)
    return APIResponse(message="Invoice updated.", data=data)


@router.delete(
    "/{invoice_id}",
    response_model=APIResponse,
    summary="Delete an invoice",
)
async def delete_invoice(
    invoice_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = InvoiceService(db, current_user.id)
    await svc.delete(invoice_id)
    return APIResponse(message="Invoice deleted.")


@router.post(
    "/{invoice_id}/send",
    response_model=APIResponse[InvoiceResponse],
    summary="Send invoice to client via email",
)
async def send_invoice(
    invoice_id: str,
    payload: SendInvoiceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = InvoiceService(db, current_user.id)
    data = await svc.send_invoice(invoice_id, payload)
    return APIResponse(message="Invoice sent.", data=data)


@router.post(
    "/{invoice_id}/cancel",
    response_model=APIResponse[InvoiceResponse],
    summary="Cancel an invoice",
)
async def cancel_invoice(
    invoice_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = InvoiceService(db, current_user.id)
    data = await svc.cancel_invoice(invoice_id)
    return APIResponse(message="Invoice cancelled.", data=data)


@router.post(
    "/{invoice_id}/payments",
    response_model=APIResponse[InvoiceResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Record a payment against an invoice (supports partial payments)",
)
async def record_payment(
    invoice_id: str,
    payload: PaymentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = InvoiceService(db, current_user.id)
    data = await svc.record_payment(invoice_id, payload)
    return APIResponse(message="Payment recorded.", data=data)

@router.get(
    "/{invoice_id}/pdf",
    summary="Download invoice as PDF",
)
async def get_invoice_pdf(
    invoice_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = InvoiceService(db, current_user.id)
    invoice = await svc.get_by_id(invoice_id)
    
    # Serialize the invoice for the PDF service
    # The Pydantic model returned by get_by_id can be converted to a dict
    invoice_data = invoice.model_dump()
    
    pdf_bytes = PDFService.generate_invoice_pdf(invoice_data, current_user)
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=invoice_{invoice.invoice_number}.pdf"
        }
    )

# (The /export/pdf endpoint is defined at the TOP of this file, before /{invoice_id})
