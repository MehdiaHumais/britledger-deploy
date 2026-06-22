from sqlalchemy import Column, String, Enum
from app.models.base import BaseModel
import enum

class VATType(str, enum.Enum):
    COLLECTED = "COLLECTED"
    PAID = "PAID"

class VATRecord(BaseModel):
    __tablename__ = "vat_records"
