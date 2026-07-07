from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Any, Optional, List
from app.models.invoice import Invoice, InvoiceStatus
from app.models.payment import PaymentSettings
from app.models.client import Client
from app.models.user import User
from app.services.stripe_service import StripeService
from app.services.email_service import EmailService
from app.services.payment_service import payment_service
from app.services.pdf_service import PDFService
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate
from fastapi import HTTPException
import os
import asyncio
import base64
import traceback

class InvoiceService:
    def __init__(self, db: AsyncSession, user_id: str):
        self.db = db
        self.user_id = user_id

    async def get_by_id(self, invoice_id: str) -> Invoice:
        result = await self.db.execute(
            select(Invoice).where(Invoice.id == invoice_id, Invoice.user_id == self.user_id)
        )
        invoice = result.scalars().first()
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        return invoice

    async def create(self, payload: InvoiceCreate) -> Invoice:
        invoice = Invoice(
            user_id=self.user_id,
            client_id=payload.client_id,
            invoice_number=payload.invoice_number,
            issue_date=payload.issue_date,
            due_date=payload.due_date,
            total_amount=payload.total_amount,
            tax_amount=payload.tax or 0.0,
            subtotal_amount=payload.subtotal or 0.0,
            currency=payload.currency or "GBP",
            status=InvoiceStatus.DRAFT,
            items=payload.items,
            notes=payload.notes
        )
        self.db.add(invoice)
        await self.db.commit()
        await self.db.refresh(invoice)
        return invoice

    async def update(self, invoice_id: str, payload: InvoiceUpdate) -> Invoice:
        invoice = await self.get_by_id(invoice_id)
        update_data = payload.model_dump(exclude_unset=True)
        if 'tax' in update_data:
            update_data['tax_amount'] = update_data.pop('tax')
        if 'subtotal' in update_data:
            update_data['subtotal_amount'] = update_data.pop('subtotal')
        for key, value in update_data.items():
            setattr(invoice, key, value)
        await self.db.commit()
        await self.db.refresh(invoice)
        return invoice

    async def send_invoice(self, invoice_id: str, payload: Any = None) -> Invoice:
        print(f"[STEP 1] Starting send_invoice for ID: {invoice_id}")
        try:
            invoice = await self.get_by_id(invoice_id)
            print(f"[STEP 2] Invoice loaded: {invoice.invoice_number}")
            
            settings = await payment_service.get_settings(self.db, self.user_id)
            print(f"[STEP 3] Payment settings loaded")
            
            user_res = await self.db.execute(select(User).where(User.id == self.user_id))
            user = user_res.scalars().first()
            print(f"[STEP 4] User loaded: {user.email if user else 'N/A'}")

            payment_links = {}
            if settings and settings.stripe_enabled:
                print(f"[STEP 5] Stripe enabled, generating link...")
                try:
                    stripe_svc = StripeService(settings)
                    base_url = os.getenv("FRONTEND_URL", "https://ledger.britsyncai.com")
                    success_url = f"{base_url}/invoices/{invoice.id}?payment=success"
                    cancel_url = f"{base_url}/invoices/{invoice.id}?payment=cancelled"
                    session = stripe_svc.create_checkout_session(invoice, success_url, cancel_url)
                    if session:
                        payment_links["stripe"] = session.url
                        print(f"[STEP 5.1] Stripe link generated")
                except Exception as se:
                    print(f"[STEP 5.ERR] Stripe Error: {str(se)}")

            client_res = await self.db.execute(select(Client).where(Client.id == invoice.client_id))
            client = client_res.scalars().first()
            print(f"[STEP 6] Client loaded: {client.name if client else 'N/A'}")
            
            target_email = None
            if payload and hasattr(payload, 'to_email'):
                target_email = payload.to_email
            elif payload and isinstance(payload, dict) and 'to_email' in payload:
                target_email = payload['to_email']
            
            if not target_email:
                target_email = client.email if client else None
            
            if not target_email:
                print(f"[STEP 6.ERR] No target email found")
                raise HTTPException(status_code=400, detail="Recipient email is required")

            print(f"[STEP 7] Generating PDF...")
            inv_data = {
                "invoice_number": invoice.invoice_number,
                "issue_date": invoice.issue_date,
                "due_date": invoice.due_date,
                "total": invoice.total_amount,
                "tax_total": invoice.tax_amount,
                "subtotal": invoice.subtotal_amount,
                "currency": invoice.currency,
                "items": invoice.items,
                "notes": invoice.notes,
                "company_name": settings.account_name if settings else None,
                "company_address": settings.company_address if settings else None,
                "company_vat": settings.company_vat_number if settings else None,
                "client": {
                    "name": client.name if client else "Valued Client", 
                    "email": target_email, 
                    "address": client.address if client else ""
                }
            }
            pdf_bytes = await asyncio.to_thread(PDFService.generate_invoice_pdf, inv_data, user)
            print(f"[STEP 8] PDF generated ({len(pdf_bytes)} bytes)")
            
            encoded = await asyncio.to_thread(base64.b64encode, pdf_bytes)
            attachments = [{
                "filename": f"Invoice_{invoice.invoice_number}.pdf",
                "content": encoded.decode('utf-8')
            }]

            company_display_name = user.full_name if user and user.full_name else (settings.account_name if settings and settings.account_name else "BritLedger AI")
                
            subject = getattr(payload, 'subject', None) or f"Invoice {invoice.invoice_number} from {company_display_name}"
            
            # Use local variables for template to avoid modifying SQLAlchemy object
            from types import SimpleNamespace
            safe_invoice = SimpleNamespace(
                invoice_number=invoice.invoice_number,
                issue_date=invoice.issue_date,
                due_date=invoice.due_date,
                currency=invoice.currency or "GBP",
                total_amount=float(invoice.total_amount or 0),
                notes=invoice.notes,
                items=invoice.items
            )

            email_svc = EmailService()
            sender_email = user.email if user else None
            html = email_svc.get_invoice_html(safe_invoice, settings, payment_links, sender_email=sender_email, sender_name=company_display_name)
            print(f"[STEP 9] Sending email to {target_email}...")
            
            result, error_msg = await asyncio.wait_for(
                asyncio.to_thread(email_svc.send_invoice_email,
                    to_email=target_email,
                    subject=subject,
                    html_content=html,
                    attachments=attachments,
                    reply_to=sender_email,
                ),
                timeout=30.0,
            )
            
            if result:
                invoice.status = InvoiceStatus.SENT
                await self.db.commit()
                print(f"[STEP 10] Email sent and status updated")
                return invoice
            else:
                print(f"[STEP 10.ERR] Resend failed: {error_msg}")
                raise HTTPException(status_code=500, detail=f"Email provider error: {error_msg}")

        except HTTPException:
            raise
        except Exception as e:
            print(f"[CRITICAL] Internal Error: {str(e)}")
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

    async def cancel_invoice(self, invoice_id: str) -> Invoice:
        invoice = await self.get_by_id(invoice_id)
        invoice.status = InvoiceStatus.CANCELLED
        await self.db.commit()
        await self.db.refresh(invoice)
        return invoice

    async def record_payment(self, invoice_id: str, payload: Any) -> Invoice:
        invoice = await self.get_by_id(invoice_id)
        invoice.status = InvoiceStatus.PAID
        await self.db.commit()
        await self.db.refresh(invoice)
        return invoice

    async def list_invoices(self, page=1, page_size=20, status_filter=None, **kwargs):
        query = select(Invoice).where(Invoice.user_id == self.user_id)
        if status_filter:
            query = query.where(Invoice.status == status_filter)
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_query)).scalar() or 0
        result = await self.db.execute(query.offset((page-1)*page_size).limit(page_size))
        invoices = result.scalars().all()
        return {"success": True, "data": invoices, "total": total, "page": page, "page_size": page_size, "total_pages": (total + page_size - 1) // page_size if total else 0}
