from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator
from uuid import UUID
from datetime import datetime
import re


class RegisterRequest(BaseModel):
    id: Optional[str] = None
    first_name: str
    last_name: str
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        # Local-first app: the Supabase password is only a sync record,
        # so we only enforce a minimum length (matches the frontend input).
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserBase(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    avatar: Optional[str] = None


class UserUpdate(UserBase):
    password: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class FingerprintRegisterRequest(BaseModel):
    device_id: str
    name: str

class FingerprintLoginRequest(BaseModel):
    device_id: str

class FingerprintUpgradeRequest(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    id: str
    is_active: bool
    is_fingerprint: bool = False
    role: Optional[str] = None
    device_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
