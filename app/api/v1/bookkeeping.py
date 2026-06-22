"""
BritLedger AI — Bookkeeping Router (Expenses, Transactions, Ledger)
GET    /bookkeeping/expenses
POST   /bookkeeping/expenses
GET    /bookkeeping/expenses/{id}
PUT    /bookkeeping/expenses/{id}
DELETE /bookkeeping/expenses/{id}
GET    /bookkeeping/transactions
GET    /bookkeeping/ledger
"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies import PaginationParams, get_current_user
from app.models.expense import ExpenseCategory
from app.models.transaction import TransactionType
from app.models.user import User
from app.schemas.common import APIResponse, PaginatedResponse
from app.schemas.finance import ExpenseCreate, ExpenseResponse, ExpenseUpdate
from app.services.bookkeeping_service import BookkeepingService

router = APIRouter(prefix="/bookkeeping", tags=["Bookkeeping"])


# ── Expenses ──────────────────────────────────────────────
@router.post(
    "/expenses",
    response_model=APIResponse[ExpenseResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Record a new expense",
)
async def create_expense(
    payload: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = BookkeepingService(db, current_user.id)
    data = await svc.create_expense(payload)
    return APIResponse(message="Expense recorded.", data=data)


@router.get(
    "/expenses",
    response_model=PaginatedResponse[ExpenseResponse],
    summary="List expenses with category and date filtering",
)
async def list_expenses(
    pagination: PaginationParams = Depends(),
    category: Optional[ExpenseCategory] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = BookkeepingService(db, current_user.id)
    return await svc.list_expenses(
        page=pagination.page,
        page_size=pagination.page_size,
        category=category,
        date_from=date_from,
        date_to=date_to,
        search=search,
    )


@router.get(
    "/expenses/{expense_id}",
    response_model=APIResponse[ExpenseResponse],
    summary="Get expense by ID",
)
async def get_expense(
    expense_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = BookkeepingService(db, current_user.id)
    data = await svc.get_expense_by_id(expense_id)
    return APIResponse(data=data)


@router.put(
    "/expenses/{expense_id}",
    response_model=APIResponse[ExpenseResponse],
    summary="Update an expense",
)
async def update_expense(
    expense_id: str,
    payload: ExpenseUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = BookkeepingService(db, current_user.id)
    data = await svc.update_expense(expense_id, payload)
    return APIResponse(message="Expense updated.", data=data)


@router.delete(
    "/expenses/{expense_id}",
    response_model=APIResponse,
    summary="Delete an expense",
)
async def delete_expense(
    expense_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = BookkeepingService(db, current_user.id)
    await svc.delete_expense(expense_id)
    return APIResponse(message="Expense deleted.")


# ── Transactions ──────────────────────────────────────────
@router.get(
    "/transactions",
    response_model=PaginatedResponse[dict],
    summary="Search transaction history with type and category filters",
)
async def list_transactions(
    pagination: PaginationParams = Depends(),
    tx_type: Optional[TransactionType] = Query(None, alias="type"),
    category: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = BookkeepingService(db, current_user.id)
    return await svc.list_transactions(
        page=pagination.page,
        page_size=pagination.page_size,
        tx_type=tx_type,
        category=category,
        date_from=date_from,
        date_to=date_to,
        search=search,
    )


# ── Ledger ────────────────────────────────────────────────
@router.get(
    "/ledger",
    response_model=PaginatedResponse[dict],
    summary="View full ledger history",
)
async def list_ledger(
    pagination: PaginationParams = Depends(),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    svc = BookkeepingService(db, current_user.id)
    return await svc.list_ledger(
        page=pagination.page,
        page_size=pagination.page_size,
        date_from=date_from,
        date_to=date_to,
    )
