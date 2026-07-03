from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.payment import PaymentSettings, PaymentTransaction, TransactionStatus, PaymentProvider
from app.models.invoice import Invoice, InvoiceStatus
from app.models.client import Client
from app.models.user import User
from app.core.encryption import encrypt_value, decrypt_value
from app.services.stripe_service import StripeService
from app.services.paypal_service import PayPalService
from app.services.email_service import EmailService
from typing import Optional
import uuid

class PaymentService:
    async def get_settings(self, db: AsyncSession, user_id: str) -> Optional[PaymentSettings]:
        import os
        result = await db.execute(select(PaymentSettings).where(PaymentSettings.user_id == user_id))
        settings = result.scalars().first()
        
        if not settings:
            # Create a temporary/virtual settings object with .env defaults
            settings = PaymentSettings(
                user_id=user_id,
                stripe_enabled=True if os.getenv("STRIPE_SECRET_KEY") else False,
                paypal_enabled=False,
                bank_transfer_enabled=False,
                stripe_secret_key=os.getenv("STRIPE_SECRET_KEY"),
                stripe_public_key=os.getenv("STRIPE_PUBLIC_KEY"),
                company_address=os.getenv("COMPANY_ADDRESS"),
                company_vat_number=os.getenv("VAT_REGISTRATION_NUMBER"),
                account_name=os.getenv("COMPANY_NAME")
            )
        else:
            # Fallback individual empty fields to .env
            if not settings.stripe_secret_key and os.getenv("STRIPE_SECRET_KEY"):
                settings.stripe_secret_key = os.getenv("STRIPE_SECRET_KEY")
                settings.stripe_enabled = True
            if not settings.company_address:
                settings.company_address = os.getenv("COMPANY_ADDRESS")
            if not settings.company_vat_number:
                settings.company_vat_number = os.getenv("VAT_REGISTRATION_NUMBER")
            if not settings.account_name:
                settings.account_name = os.getenv("COMPANY_NAME")
            
            # Ensure boolean fields are NOT None (fixes 500 error)
            if settings.paypal_enabled is None:
                settings.paypal_enabled = False
            if settings.bank_transfer_enabled is None:
                settings.bank_transfer_enabled = False
            if settings.stripe_enabled is None:
                settings.stripe_enabled = False
                
        return settings

    async def update_settings(self, db: AsyncSession, user_id: str, settings_data: dict) -> PaymentSettings:
        settings = await self.get_settings(db, user_id)
        if not settings:
            settings = PaymentSettings(user_id=user_id)
            db.add(settings)

        # Encrypt sensitive keys before saving
        if "stripe_secret_key" in settings_data:
            settings_data["stripe_secret_key"] = encrypt_value(settings_data["stripe_secret_key"])
        if "stripe_webhook_secret" in settings_data:
            settings_data["stripe_webhook_secret"] = encrypt_value(settings_data["stripe_webhook_secret"])
        if "paypal_client_secret" in settings_data:
            settings_data["paypal_client_secret"] = encrypt_value(settings_data["paypal_client_secret"])

        for key, value in settings_data.items():
            setattr(settings, key, value)

        await db.commit()
        await db.refresh(settings)
        return settings

    async def handle_payment_success(self, db: AsyncSession, invoice_id: str, provider: PaymentProvider, transaction_id: str, amount: float):
        result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
        invoice = result.scalars().first()
        if not invoice:
            return

        # Update Invoice Status
        invoice.status = InvoiceStatus.PAID
        
        # Create Transaction Record
        transaction = PaymentTransaction(
            user_id=invoice.user_id,
            invoice_id=invoice.id,
            provider=provider,
            provider_transaction_id=transaction_id,
            amount=amount,
            currency=invoice.currency,
            status=TransactionStatus.COMPLETED
        )
        db.add(transaction)
        
        # Send Confirmation Email
        email_svc = EmailService()
        
        # Get client email
        client_result = await db.execute(select(Client).where(Client.id == invoice.client_id))
        client = client_result.scalars().first()
        
        # Get sender user info
        user_result = await db.execute(select(User).where(User.id == invoice.user_id))
        user = user_result.scalars().first()
        
        if client and client.email:
            email_svc.send_invoice_email(
                to_email=client.email,
                subject=f"Payment Confirmation - Invoice {invoice.invoice_number}",
                html_content=f"<div style='font-family:sans-serif;'><h2>Payment Received!</h2><p>Thank you for your payment of <b>{invoice.currency} {amount}</b> for invoice <b>{invoice.invoice_number}</b>.</p><p>A receipt has been generated for your records.</p></div>",
                reply_to=user.email if user else None,
            )
        
        await db.commit()

payment_service = PaymentService()
