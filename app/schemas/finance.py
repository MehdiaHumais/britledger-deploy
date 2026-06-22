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
