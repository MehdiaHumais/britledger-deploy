from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date
from typing import Any, Optional, List
from app.models.quotation import Quotation, QuotationStatus
from app.models.client import Client
from app.models.user import User
from app.models.payment import PaymentSettings
from app.services.payment_service import payment_service
from app.services.stripe_service import StripeService
from app.services.email_service import EmailService
from app.services.pdf_service import PDFService
from app.schemas.quotation import QuotationCreate, QuotationUpdate
from fastapi import HTTPException
import os
import base64
import traceback
from types import SimpleNamespace

class QuotationService:
    def __init__(self, db: AsyncSession, user_id: str):
        self.db = db
        self.user_id = user_id

    async def get_by_id(self, quotation_id: str) -> Quotation:
        result = await self.db.execute(
            select(Quotation).where(Quotation.id == quotation_id, Quotation.user_id == self.user_id)
        )
        quotation = result.scalars().first()
        if not quotation:
            raise HTTPException(status_code=404, detail="Quotation not found")
        return quotation

    async def create(self, payload: QuotationCreate) -> Quotation:
        quotation = Quotation(
            user_id=self.user_id,
            client_id=payload.client_id,
            quotation_number=payload.quotation_number,
            issue_date=payload.issue_date,
            expiry_date=payload.expiry_date,
            total_amount=payload.total_amount,
            tax_amount=payload.tax or 0.0,
            subtotal_amount=payload.subtotal or 0.0,
            currency=payload.currency or "GBP",
            status=QuotationStatus.DRAFT,
            items=payload.items,
            notes=payload.notes
        )
        self.db.add(quotation)
        await self.db.commit()
        await self.db.refresh(quotation)
        return quotation

    async def update(self, quotation_id: str, payload: QuotationUpdate) -> Quotation:
        quotation = await self.get_by_id(quotation_id)
        update_data = payload.model_dump(exclude_unset=True)
        
        if 'tax' in update_data:
            update_data['tax_amount'] = update_data.pop('tax')
        if 'subtotal' in update_data:
            update_data['subtotal_amount'] = update_data.pop('subtotal')
            
        for key, value in update_data.items():
            setattr(quotation, key, value)
            
        await self.db.commit()
        await self.db.refresh(quotation)
        return quotation

    async def send_quotation(self, quotation_id: str, payload: Any = None) -> Quotation:
        print(f"🚀 [STEP 1] Starting send_quotation for ID: {quotation_id}")
        try:
            quotation = await self.get_by_id(quotation_id)
            print(f"📝 [STEP 2] Quotation loaded: {quotation.quotation_number}")
            
            email_svc = EmailService()
            client_res = await self.db.execute(select(Client).where(Client.id == quotation.client_id))
            client = client_res.scalars().first()
            print(f"🤝 [STEP 3] Client loaded: {client.name if client else 'N/A'}")
            
            target_email = None
            if payload and hasattr(payload, 'to_email'):
                target_email = payload.to_email
            elif payload and isinstance(payload, dict) and 'to_email' in payload:
                target_email = payload['to_email']
            
            if not target_email:
                target_email = client.email if client else None
            
            if not target_email:
                print(f"❌ [STEP 3.ERR] No target email found")
                raise HTTPException(status_code=400, detail="Recipient email is required")

            settings = await payment_service.get_settings(self.db, self.user_id)
            user_res = await self.db.execute(select(User).where(User.id == self.user_id))
            user = user_res.scalars().first()
            print(f"⚙️ [STEP 4] Settings and User loaded")

            payment_links = {}
            if settings and settings.stripe_enabled:
                print(f"💳 [STEP 5] Generating Stripe link...")
                try:
                    stripe_svc = StripeService(settings)
                    base_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
                    success_url = f"{base_url}/quotations/{quotation.id}?status=accepted"
                    cancel_url = f"{base_url}/quotations/{quotation.id}"
                    
                    session = stripe_svc.create_checkout_session(quotation, success_url, cancel_url)
                    if session:
                        payment_links["stripe"] = session.url
                        print(f"🔗 [STEP 5.1] Stripe link generated")
                except Exception as e:
                    print(f"⚠️ [STEP 5.ERR] Stripe Error: {e}")

            print(f"📄 [STEP 6] Generating PDF...")
            quot_data = {
                "quotation_number": quotation.quotation_number,
                "issue_date": quotation.issue_date,
                "expiry_date": quotation.expiry_date,
                "total_amount": quotation.total_amount,
                "tax_amount": quotation.tax_amount,
                "subtotal_amount": quotation.subtotal_amount,
                "currency": quotation.currency,
                "items": quotation.items,
                "notes": quotation.notes,
                "company_name": settings.account_name if settings else None,
                "company_address": settings.company_address if settings else None,
                "company_vat": settings.company_vat_number if settings else None,
                "client": {
                    "name": client.name if client else "Valued Client", 
                    "email": target_email, 
                    "address": client.address if client else ""
                }
            }
            pdf_bytes = PDFService.generate_quotation_pdf(quot_data, user)
            print(f"📎 [STEP 7] PDF generated ({len(pdf_bytes)} bytes)")
            
            attachments = [
                {
                    "filename": f"Quotation_{quotation.quotation_number}.pdf",
                    "content": base64.b64encode(pdf_bytes).decode('utf-8')
                }
            ]

            # Safe numeric conversion for template
            safe_quotation = SimpleNamespace(
                quotation_number=quotation.quotation_number,
                issue_date=quotation.issue_date,
                expiry_date=quotation.expiry_date,
                currency=quotation.currency or "GBP",
                total_amount=float(quotation.total_amount or 0),
                notes=quotation.notes,
                items=quotation.items
            )

            email_content = email_svc.get_quotation_html(safe_quotation, settings, payment_links)
            
            company_display_name = "BritLedger AI"
            if settings and settings.account_name:
                company_display_name = settings.account_name
            elif user and user.full_name:
                company_display_name = user.full_name

            print(f"📧 [STEP 8] Sending email to {target_email}...")
            result, error_msg = email_svc.send_invoice_email(
                to_email=target_email,
                subject=f"Quotation {quotation.quotation_number} from {company_display_name}",
                html_content=email_content,
                attachments=attachments
            )
            
            if result:
                quotation.status = QuotationStatus.SENT
                await self.db.commit()
                await self.db.refresh(quotation)
                print(f"✅ [STEP 9] Email sent and status updated")
                return quotation
            else:
                print(f"❌ [STEP 9.ERR] Resend failed: {error_msg}")
                raise HTTPException(status_code=500, detail=f"Email provider error: {error_msg}")
        except HTTPException:
            raise
        except Exception as e:
            print(f"💥 [CRITICAL] Internal Error: {str(e)}")
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

    async def convert_to_invoice(self, quotation_id: str, payload: Any) -> str:
        quotation = await self.get_by_id(quotation_id)
        
        from app.models.invoice import Invoice, InvoiceStatus
        invoice = Invoice(
            user_id=self.user_id,
            client_id=quotation.client_id,
            invoice_number=f"INV-FROM-{quotation.quotation_number}",
            issue_date=date.today(),
            total_amount=quotation.total_amount,
            tax_amount=quotation.tax_amount,
            subtotal_amount=quotation.subtotal_amount,
            currency=quotation.currency,
            status=InvoiceStatus.DRAFT,
            items=quotation.items,
            notes=quotation.notes
        )
        self.db.add(invoice)
        quotation.status = QuotationStatus.CONVERTED
        await self.db.commit()
        await self.db.refresh(invoice)
        return invoice.id

    async def list_quotations(self, page=1, page_size=20, status_filter=None, **kwargs):
        query = select(Quotation).where(Quotation.user_id == self.user_id)
        if status_filter:
            query = query.where(Quotation.status == status_filter)
        if kwargs.get('client_id'):
            query = query.where(Quotation.client_id == kwargs.get('client_id'))
            
        result = await self.db.execute(query.offset((page-1)*page_size).limit(page_size))
        quotations = result.scalars().all()
        return {"success": True, "data": quotations, "total": len(quotations), "page": page, "page_size": page_size}
