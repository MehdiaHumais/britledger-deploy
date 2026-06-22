from pydantic import BaseModel
from typing import Optional
from uuid import UUID

class PaymentSettingsBase(BaseModel):
    stripe_public_key: Optional[str] = None
    stripe_account_id: Optional[str] = None
    stripe_enabled: Optional[bool] = False
    paypal_client_id: Optional[str] = None
    paypal_enabled: Optional[bool] = False
    bank_name: Optional[str] = None
    account_name: Optional[str] = None
    account_number: Optional[str] = None
    sort_code: Optional[str] = None
    iban: Optional[str] = None
    swift_bic: Optional[str] = None
    bank_transfer_enabled: Optional[bool] = False
    company_logo_url: Optional[str] = None
    company_vat_number: Optional[str] = None
    company_address: Optional[str] = None

class PaymentSettingsUpdate(PaymentSettingsBase):
    stripe_secret_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    paypal_client_secret: Optional[str] = None

class PaymentSettingsRead(PaymentSettingsBase):
    user_id: str
    # We don't expose secrets back to the frontend

class PaymentSessionCreate(BaseModel):
    invoice_id: str
    provider: str # "stripe" or "paypal"
    success_url: str
    cancel_url: str
