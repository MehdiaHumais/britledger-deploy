"""
BritLedger AI — VAT Router
GET  /vat/summary
GET  /vat/records
GET  /vat/report
"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import PaginationParams, get_current_user
from app.models.user import User
from app.models.vat import VATType
from app.schemas.common import APIResponse, PaginatedResponse
from app.schemas.finance import VATRecordResponse, VATSummary
from app.services.bookkeeping_service import BookkeepingService

router = APIRouter(prefix="/vat", tags=["VAT"])


@router.get(
    "/summary",
    response_model=APIResponse[VATSummary],
    summary="Get VAT summary for a period (UK VAT return boxes 1-7)",
)
async def get_vat_summary(
    period_start: date = Query(..., description="Period start date YYYY-MM-DD"),
    period_end: date = Query(..., description="Period end date YYYY-MM-DD"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = BookkeepingService(db, current_user.id)
    data = await svc.get_vat_summary(period_start, period_end)
    return APIResponse(data=data)


@router.get(
    "/records",
    response_model=PaginatedResponse[VATRecordResponse],
    summary="List all VAT records (collected and paid)",
)
async def list_vat_records(
    pagination: PaginationParams = Depends(),
    period_start: Optional[date] = Query(None),
    period_end: Optional[date] = Query(None),
    vat_type: Optional[VATType] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = BookkeepingService(db, current_user.id)
    return await svc.list_vat_records(
        page=pagination.page,
        page_size=pagination.page_size,
        period_start=period_start,
        period_end=period_end,
        vat_type=vat_type,
    )


@router.get(
    "/report",
    response_model=APIResponse[VATSummary],
    summary="VAT return estimate for the current quarter",
)
async def current_quarter_vat(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    import calendar
    today = date.today()
    q = (today.month - 1) // 3 + 1
    qs = (q - 1) * 3 + 1
    qe_month = qs + 2
    qe_day = calendar.monthrange(today.year, qe_month)[1]
    period_start = date(today.year, qs, 1)
    period_end = date(today.year, qe_month, qe_day)

    svc = BookkeepingService(db, current_user.id)
    data = await svc.get_vat_summary(period_start, period_end)
    return APIResponse(
        message=f"VAT estimate for Q{q} {today.year} ({period_start} to {period_end}).",
        data=data,
    )
