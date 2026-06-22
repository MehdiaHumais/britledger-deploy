from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import date
from app.models.quotation import QuotationStatus

class QuotationCreate(BaseModel):
    client_id: str
    quotation_number: str
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    total_amount: float
    subtotal: Optional[float] = 0.0
    tax: Optional[float] = 0.0
    currency: Optional[str] = "GBP"
    items: Optional[List[Any]] = []
    notes: Optional[str] = None

class QuotationUpdate(BaseModel):
    client_id: Optional[str] = None
    quotation_number: Optional[str] = None
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    total_amount: Optional[float] = None
    subtotal: Optional[float] = None
    tax: Optional[float] = None
    currency: Optional[str] = None
    items: Optional[List[Any]] = None
    notes: Optional[str] = None
    status: Optional[QuotationStatus] = None

class QuotationResponse(BaseModel):
    id: str
    client_id: str
    quotation_number: str
    status: QuotationStatus
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    total_amount: float
    tax_amount: float = 0.0
    subtotal_amount: float = 0.0
    currency: str = "GBP"
    items: Optional[List[Any]] = []
    notes: Optional[str] = None
    
    class Config: from_attributes = True

class ConvertToInvoiceRequest(BaseModel):
    pass
