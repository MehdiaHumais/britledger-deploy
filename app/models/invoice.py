from sqlalchemy import Column, String, ForeignKey, Enum, Float, Date, JSON
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
    user_id = Column(String(50), ForeignKey("users.id"), nullable=False)
    client_id = Column(String(50), ForeignKey("clients.id"), nullable=False)
    invoice_number = Column(String(50), nullable=False)
    status = Column(Enum(InvoiceStatus), default=InvoiceStatus.DRAFT)
    
    # Dates
    issue_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    
    # Financial Details
    total_amount = Column(Float, nullable=False, default=0.0)
    tax_amount = Column(Float, nullable=False, default=0.0)
    subtotal_amount = Column(Float, nullable=False, default=0.0)
    currency = Column(String(10), default="GBP")
    
    # Items (Stored as JSON list)
    items = Column(JSON, nullable=True)
    
    # Payment Links (Generated)
    stripe_payment_link = Column(String(255), nullable=True)
    paypal_payment_link = Column(String(255), nullable=True)
    
    # Notes & Terms
    notes = Column(String, nullable=True)
    terms = Column(String, nullable=True)
