from sqlalchemy import Boolean, Column, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import BaseModel

class Client(BaseModel):
    __tablename__ = "clients"

    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(String(1000), nullable=True)
    company_name = Column(String(255), nullable=True)
    vat_number = Column(String(50), nullable=True)
    is_active = Column(Boolean(), default=True)
