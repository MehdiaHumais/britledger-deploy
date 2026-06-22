from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import date
from app.models.invoice import InvoiceStatus

class InvoiceCreate(BaseModel):
    client_id: str
    invoice_number: str
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    total_amount: float
    subtotal: Optional[float] = 0.0
    tax: Optional[float] = 0.0
    currency: Optional[str] = "GBP"
    items: Optional[List[Any]] = []
    notes: Optional[str] = None

class InvoiceUpdate(BaseModel):
    client_id: Optional[str] = None
    invoice_number: Optional[str] = None
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    total_amount: Optional[float] = None
    subtotal: Optional[float] = None
    tax: Optional[float] = None
    currency: Optional[str] = None
    items: Optional[List[Any]] = None
    notes: Optional[str] = None
    status: Optional[InvoiceStatus] = None

class InvoiceResponse(BaseModel):
    id: str
    client_id: str
    invoice_number: str
    status: InvoiceStatus
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    total_amount: float
    tax_amount: float = 0.0
    subtotal_amount: float = 0.0
    currency: str = "GBP"
    items: Optional[List[Any]] = []
    notes: Optional[str] = None
    
    class Config: from_attributes = True
class SendInvoiceRequest(BaseModel):
    to_email: str
    subject: Optional[str] = None
    personal_message: Optional[str] = None
