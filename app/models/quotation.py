from sqlalchemy import Column, String, ForeignKey, Enum, Float, Date, JSON
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
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(String(50), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    quotation_number = Column(String(50), nullable=False)
    status = Column(Enum(QuotationStatus), default=QuotationStatus.DRAFT)
    
    # Dates
    issue_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)
    
    # Financial Details
    total_amount = Column(Float, nullable=False, default=0.0)
    tax_amount = Column(Float, nullable=False, default=0.0)
    subtotal_amount = Column(Float, nullable=False, default=0.0)
    currency = Column(String(10), default="GBP")
    
    # Items (Stored as JSON list)
    items = Column(JSON, nullable=True)
    
    # Notes & Terms
    notes = Column(String, nullable=True)
    terms = Column(String, nullable=True)
