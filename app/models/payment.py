from sqlalchemy import Column, String, ForeignKey, Enum, Float, Boolean, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import BaseModel
import enum

class PaymentProvider(str, enum.Enum):
    STRIPE = "STRIPE"
    PAYPAL = "PAYPAL"
    BANK_TRANSFER = "BANK_TRANSFER"

class TransactionStatus(str, enum.Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"

class PaymentSettings(BaseModel):
    __tablename__ = "payment_settings"
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # Stripe Credentials (Connect OAuth)
    stripe_account_id = Column(String(100), nullable=True)
    stripe_public_key = Column(String(255), nullable=True)
    stripe_secret_key = Column(Text, nullable=True)  # Encrypted
    stripe_webhook_secret = Column(Text, nullable=True) # Encrypted
    stripe_enabled = Column(Boolean, default=False)
    
    # PayPal Credentials (Encrypted)
    paypal_client_id = Column(String(255), nullable=True)
    paypal_client_secret = Column(Text, nullable=True) # Encrypted
    paypal_webhook_id = Column(String(255), nullable=True)
    paypal_enabled = Column(Boolean, default=False)
    
    # Bank Transfer Details
    bank_name = Column(String(255), nullable=True)
    account_name = Column(String(255), nullable=True)
    account_number = Column(String(50), nullable=True)
    sort_code = Column(String(20), nullable=True)
    iban = Column(String(50), nullable=True)
    swift_bic = Column(String(50), nullable=True)
    bank_transfer_enabled = Column(Boolean, default=False)
    
    # Company Branding
    company_logo_url = Column(String(255), nullable=True)
    company_vat_number = Column(String(50), nullable=True)
    company_address = Column(Text, nullable=True)

class PaymentTransaction(BaseModel):
    __tablename__ = "payment_transactions"
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    invoice_id = Column(String(50), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    provider = Column(Enum(PaymentProvider), nullable=False)
    provider_transaction_id = Column(String(255), nullable=True)
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default="GBP")
    status = Column(Enum(TransactionStatus), default=TransactionStatus.PENDING)
    metadata_json = Column(JSON, nullable=True)

class WebhookLog(BaseModel):
    __tablename__ = "webhook_logs"
    provider = Column(Enum(PaymentProvider), nullable=False)
    payload = Column(JSON, nullable=False)
    status_code = Column(String(10), nullable=True)
    error_message = Column(Text, nullable=True)
