from sqlalchemy import Boolean, Column, String, Text, Enum
from app.models.base import BaseModel
import enum

class UserRole(str, enum.Enum):
    SUPERADMIN = "SUPERADMIN"
    ADMIN = "ADMIN"
    ACCOUNTANT = "ACCOUNTANT"
    VIEWER = "VIEWER"

class User(BaseModel):
    __tablename__ = "users"

    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    avatar = Column(String, nullable=True)
    is_active = Column(Boolean(), default=True)
    role = Column(Enum(UserRole), default=UserRole.ADMIN)
    device_id = Column(String(255), nullable=True, index=True)
    company_name = Column(String(255), nullable=True)
    vat_number = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    email_notifications = Column(Boolean, default=True)
    ai_notifications = Column(Boolean, default=True)
