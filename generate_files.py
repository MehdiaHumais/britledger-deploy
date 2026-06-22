import os

BASE_DIR = r"E:\sir projectss\BritLedger\app"

FILES = {
    # ------------------ API ROUTERS ------------------
    r"api\v1\auth.py": """
from fastapi import APIRouter, Depends
from app.schemas.common import APIResponse

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/login")
async def login():
    return {"access_token": "fake_token", "token_type": "bearer"}
""",
    
    # ------------------ MODELS ------------------
    r"models\invoice.py": """
from sqlalchemy import Column, String, ForeignKey, Enum, Float, Date
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import BaseModel
import enum

class InvoiceStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    PAID = "PAID"
    PARTIAL = "PARTIAL"
    OVERDUE = "OVERDUE"
    CANCELLED = "CANCELLED"

class Invoice(BaseModel):
    __tablename__ = "invoices"
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    invoice_number = Column(String(50), nullable=False)
    status = Column(Enum(InvoiceStatus), default=InvoiceStatus.DRAFT)
""",
    r"models\quotation.py": """
from sqlalchemy import Column, String, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import BaseModel
import enum

class QuotationStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    CONVERTED = "CONVERTED"

class Quotation(BaseModel):
    __tablename__ = "quotations"
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    quotation_number = Column(String(50), nullable=False)
    status = Column(Enum(QuotationStatus), default=QuotationStatus.DRAFT)
""",
    r"models\payment.py": """
from app.models.base import BaseModel
class Payment(BaseModel):
    __tablename__ = "payments"
""",
    r"models\expense.py": """
from sqlalchemy import Column, String, Enum
from app.models.base import BaseModel
import enum

class ExpenseCategory(str, enum.Enum):
    SOFTWARE = "SOFTWARE"
    TRAVEL = "TRAVEL"
    OFFICE = "OFFICE"

class Expense(BaseModel):
    __tablename__ = "expenses"
""",
    r"models\transaction.py": """
from sqlalchemy import Column, String, Enum
from app.models.base import BaseModel
import enum

class TransactionType(str, enum.Enum):
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"

class Transaction(BaseModel):
    __tablename__ = "transactions"
""",
    r"models\vat.py": """
from sqlalchemy import Column, String, Enum
from app.models.base import BaseModel
import enum

class VATType(str, enum.Enum):
    COLLECTED = "COLLECTED"
    PAID = "PAID"

class VATRecord(BaseModel):
    __tablename__ = "vat_records"
""",
    r"models\ai_log.py": """
from app.models.base import BaseModel
class AILog(BaseModel):
    __tablename__ = "ai_logs"
""",
    r"models\__init__.py": """
from .base import BaseModel
from .user import User
from .client import Client
from .invoice import Invoice
from .quotation import Quotation
from .payment import Payment
from .expense import Expense
from .transaction import Transaction
from .vat import VATRecord
from .ai_log import AILog
""",

    # ------------------ SCHEMAS ------------------
    r"schemas\__init__.py": "",
    r"schemas\invoice.py": """
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID
from app.models.invoice import InvoiceStatus

class InvoiceCreate(BaseModel):
    client_id: UUID
    invoice_number: str
class InvoiceUpdate(BaseModel):
    pass
class InvoiceResponse(BaseModel):
    id: UUID
    client_id: UUID
    invoice_number: str
    status: InvoiceStatus
    class Config: from_attributes = True
class SendInvoiceRequest(BaseModel):
    email_to: str
""",
    r"schemas\quotation.py": """
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from app.models.quotation import QuotationStatus

class QuotationCreate(BaseModel):
    client_id: UUID
    quotation_number: str
class QuotationUpdate(BaseModel):
    pass
class QuotationResponse(BaseModel):
    id: UUID
    client_id: UUID
    quotation_number: str
    status: QuotationStatus
    class Config: from_attributes = True
class ConvertToInvoiceRequest(BaseModel):
    pass
""",
    r"schemas\finance.py": """
from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID

class PaymentCreate(BaseModel):
    amount: float
class PaymentResponse(BaseModel):
    id: UUID
    amount: float
class ExpenseCreate(BaseModel):
    amount: float
class ExpenseUpdate(BaseModel):
    amount: Optional[float]
class ExpenseResponse(BaseModel):
    id: UUID
    amount: float
class VATSummary(BaseModel):
    box1: float = 0
    box2: float = 0
    box3: float = 0
    box4: float = 0
    box5: float = 0
    box6: float = 0
    box7: float = 0
class VATRecordResponse(BaseModel):
    id: UUID
class ProfitLossReport(BaseModel):
    total_revenue: float = 0
    total_expenses: float = 0
    net_profit: float = 0
class RevenueReport(BaseModel):
    total_invoiced: float = 0
class ExpenseReport(BaseModel):
    total_expenses: float = 0
class YearlyReport(BaseModel):
    year: int
""",
    r"schemas\auth.py": """
from pydantic import BaseModel
""",

    # ------------------ SERVICES ------------------
    r"services\__init__.py": "",
    r"services\invoice_service.py": """
class InvoiceService:
    def __init__(self, db, user_id):
        self.db = db
        self.user_id = user_id
    async def create(self, payload): return {"id": "00000000-0000-0000-0000-000000000000"}
    async def get_by_id(self, invoice_id): return {"id": invoice_id}
    async def update(self, invoice_id, payload): return {"id": invoice_id}
    async def send_invoice(self, invoice_id, payload): return {"id": invoice_id}
    async def cancel_invoice(self, invoice_id): return {"id": invoice_id}
    async def record_payment(self, invoice_id, payload): return {"id": invoice_id}
    async def list_invoices(self, **kwargs):
        return {"success": True, "data": [], "total": 0, "page": 1, "page_size": 20, "total_pages": 0}
""",
    r"services\quotation_service.py": """
class QuotationService:
    def __init__(self, db, user_id):
        self.db = db
        self.user_id = user_id
    async def create(self, payload): return {"id": "00000000-0000-0000-0000-000000000000"}
    async def get_by_id(self, quotation_id): return {"id": quotation_id}
    async def update(self, quotation_id, payload): return {"id": quotation_id}
    async def send_quotation(self, quotation_id): return {"id": quotation_id}
    async def convert_to_invoice(self, quotation_id, payload): return "00000000-0000-0000-0000-000000000000"
    async def list_quotations(self, **kwargs):
        return {"success": True, "data": [], "total": 0, "page": 1, "page_size": 20, "total_pages": 0}
""",
    r"services\bookkeeping_service.py": """
class BookkeepingService:
    def __init__(self, db, user_id):
        self.db = db
        self.user_id = user_id
    async def create_expense(self, payload): return {"id": "00000000-0000-0000-0000-000000000000"}
    async def get_expense_by_id(self, expense_id): return {"id": expense_id}
    async def update_expense(self, expense_id, payload): return {"id": expense_id}
    async def delete_expense(self, expense_id): pass
    async def list_expenses(self, **kwargs):
        return {"success": True, "data": [], "total": 0, "page": 1, "page_size": 20, "total_pages": 0}
    async def list_transactions(self, **kwargs):
        return {"success": True, "data": [], "total": 0, "page": 1, "page_size": 20, "total_pages": 0}
    async def list_ledger(self, **kwargs):
        return {"success": True, "data": [], "total": 0, "page": 1, "page_size": 20, "total_pages": 0}
    async def get_vat_summary(self, *args):
        return {"box1": 0}
    async def list_vat_records(self, **kwargs):
        return {"success": True, "data": [], "total": 0, "page": 1, "page_size": 20, "total_pages": 0}
""",
    r"services\report_service.py": """
class ReportService:
    def __init__(self, db, user_id):
        self.db = db
        self.user_id = user_id
    async def profit_loss(self, date_from, date_to): return {}
    async def revenue_summary(self, date_from, date_to): return {}
    async def expense_summary(self, date_from, date_to): return {}
    async def yearly_report(self, year, fiscal_year_start): return {"year": year}
""",
    r"services\user_service.py": """
class UserService:
    pass
"""
}

for filepath, content in FILES.items():
    full_path = os.path.join(BASE_DIR, filepath)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\\n")
    print(f"Created: {full_path}")
