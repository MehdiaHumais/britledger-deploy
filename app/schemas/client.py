from typing import Optional
from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime

class ClientBase(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    company_name: Optional[str] = None
    vat_number: Optional[str] = None
    is_active: bool = True

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    company_name: Optional[str] = None
    vat_number: Optional[str] = None
    is_active: Optional[bool] = None

class ClientResponse(ClientBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class ClientBalances(BaseModel):
    client_id: str
    total_invoiced: float
    total_paid: float
    outstanding_balance: float
