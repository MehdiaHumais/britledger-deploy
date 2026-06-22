"""
BritLedger AI — API v1 Router Aggregator
Registers all sub-routers into a single v1 router.
"""

from fastapi import APIRouter

from app.api.v1 import auth, bookkeeping, clients, invoices, quotations, reports, vat, users, payments, ai

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(clients.router)
api_router.include_router(invoices.router)
api_router.include_router(quotations.router)
api_router.include_router(bookkeeping.router)
api_router.include_router(vat.router)
api_router.include_router(reports.router)
api_router.include_router(payments.router)
api_router.include_router(ai.router)
