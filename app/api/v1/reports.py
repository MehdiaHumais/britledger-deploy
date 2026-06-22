"""
BritLedger AI — Reports Router
GET /reports/profit-loss
GET /reports/revenue
GET /reports/expenses
GET /reports/yearly/{year}
"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Body, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.finance import (
    ExpenseReport,
    ProfitLossReport,
    RevenueReport,
    YearlyReport,
)
from app.services.report_service import ReportService
from app.services.pdf_service import PDFService

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get(
    "/profit-loss",
    response_model=APIResponse[ProfitLossReport],
    summary="Profit & loss report for a date range",
)
async def profit_loss(
    date_from: date = Query(...),
    date_to: date = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ReportService(db, current_user.id)
    data = await svc.profit_loss(date_from, date_to)
    return APIResponse(data=data)


@router.get(
    "/revenue",
    response_model=APIResponse[RevenueReport],
    summary="Revenue summary: invoiced, collected, outstanding, overdue",
)
async def revenue_summary(
    date_from: date = Query(...),
    date_to: date = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ReportService(db, current_user.id)
    data = await svc.revenue_summary(date_from, date_to)
    return APIResponse(data=data)


@router.get(
    "/expenses",
    response_model=APIResponse[ExpenseReport],
    summary="Expense summary by category and month",
)
async def expense_summary(
    date_from: date = Query(...),
    date_to: date = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ReportService(db, current_user.id)
    data = await svc.expense_summary(date_from, date_to)
    return APIResponse(data=data)


@router.get(
    "/yearly/{year}",
    response_model=APIResponse[YearlyReport],
    summary="Complete yearly report (P&L + Revenue + Expenses + VAT)",
)
async def yearly_report(
    year: int,
    fiscal_year_start: int = Query(4, ge=1, le=12, description="Fiscal year start month (UK=4)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ReportService(db, current_user.id)
    data = await svc.yearly_report(year, fiscal_year_start)
    return APIResponse(data=data)

@router.post(
    "/export/pdf",
    summary="Export a pre-computed report as PDF (no auth required)",
)
async def export_report_pdf_raw(
    payload: dict = Body(...),
):
    """
    Accepts pre-computed report data from the frontend local-db and returns a PDF.
    No authentication or DB access required.
    """
    class _MockUser:
        company_name = payload.get("company_name") or "BritLedger AI"
        email = ""
        address = ""
        vat_number = ""
        name = company_name

    title = payload.get("title", "Financial Report")
    report_data = payload.get("data", payload)
    pdf_bytes = PDFService.generate_report_pdf(report_data, _MockUser(), title)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="report.pdf"'
        }
    )


@router.get(
    "/export/pdf",
    summary="Export any report as PDF (requires auth + DB)",
)
async def export_report_pdf(
    report_type: str = Query(..., description="profit-loss, revenue, expenses, yearly"),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    year: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = ReportService(db, current_user.id)
    title = ""
    report_data = {}
    
    if report_type == "profit-loss" and date_from and date_to:
        data = await svc.profit_loss(date_from, date_to)
        title = "Profit and Loss Statement"
        report_data = data.model_dump()
    elif report_type == "revenue" and date_from and date_to:
        data = await svc.revenue_summary(date_from, date_to)
        title = "Revenue Summary"
        report_data = data.model_dump()
    elif report_type == "expenses" and date_from and date_to:
        data = await svc.expense_summary(date_from, date_to)
        title = "Expense Summary"
        report_data = data.model_dump()
    elif report_type == "yearly" and year:
        data = await svc.yearly_report(year, 4)
        title = f"Yearly Financial Report ({year})"
        report_data = data.model_dump()
    else:
        return APIResponse(success=False, message="Invalid parameters for report type", status_code=400)
    
    # Generate the PDF
    pdf_bytes = PDFService.generate_report_pdf(report_data, current_user, title)
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={report_type}_report.pdf"
        }
    )
