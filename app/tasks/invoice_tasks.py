"""
BritLedger AI — Invoice Celery Tasks (Recurring & Reminders)
"""

from __future__ import annotations

from app.core.celery_app import celery_app
from app.core.logging import get_logger

logger = get_logger(__name__)


@celery_app.task(
    name="app.tasks.invoice_tasks.process_recurring_invoices",
    queue="default",
)
def process_recurring_invoices() -> dict:
    """
    Celery beat task — generates child invoices for all
    recurring parent invoices that are due today.
    Runs every hour via beat schedule.
    """
    import asyncio
    from app.core.database import AsyncSessionLocal
    from app.services.invoice_service import InvoiceService

    async def _run():
        async with AsyncSessionLocal() as db:
            # Find all unique owner_ids with recurring invoices
            from sqlalchemy import select, distinct
            from app.models.invoice import Invoice
            result = await db.execute(
                select(distinct(Invoice.owner_id)).where(Invoice.is_recurring == True)  # noqa: E712
            )
            owner_ids = result.scalars().all()
            total_created = 0
            for owner_id in owner_ids:
                svc = InvoiceService(db, owner_id)
                created = await svc.generate_recurring_children()
                total_created += len(created)
                logger.info("recurring_invoices_generated", owner=owner_id, count=len(created))
            await db.commit()
            return total_created

    count = asyncio.get_event_loop().run_until_complete(_run())
    return {"generated": count}


@celery_app.task(
    name="app.tasks.invoice_tasks.send_payment_reminders",
    queue="default",
)
def send_payment_reminders() -> dict:
    """
    Celery beat task — marks overdue invoices and queues reminder emails.
    Runs daily.
    """
    import asyncio
    from datetime import date
    from app.core.database import AsyncSessionLocal
    from app.models.invoice import Invoice, InvoiceStatus
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    async def _run():
        async with AsyncSessionLocal() as db:
            today = date.today()
            result = await db.execute(
                select(Invoice)
                .options(selectinload(Invoice.client))
                .where(
                    Invoice.status.in_([InvoiceStatus.SENT, InvoiceStatus.PARTIAL]),
                    Invoice.due_date < today,
                )
            )
            invoices = result.scalars().all()
            reminded = 0
            for inv in invoices:
                inv.status = InvoiceStatus.OVERDUE
                if inv.client and inv.client.email:
                    from app.tasks.email_tasks import send_payment_reminder
                    send_payment_reminder.delay(inv.id, inv.client.email)
                    reminded += 1
            await db.commit()
            return {"overdue_marked": len(invoices), "reminders_queued": reminded}

    return asyncio.get_event_loop().run_until_complete(_run())


@celery_app.task(
    name="app.tasks.invoice_tasks.generate_invoice_pdf",
    queue="default",
    bind=True,
    max_retries=2,
)
def generate_invoice_pdf(self, invoice_id: str) -> dict:
    """Generate a PDF for an invoice and store it."""
    try:
        logger.info("generating_invoice_pdf", invoice_id=invoice_id)
        # In production: use weasyprint / reportlab
        # pdf_path = f"./storage/invoices/{invoice_id}.pdf"
        # ... generate and save ...
        return {"status": "generated", "invoice_id": invoice_id}
    except Exception as exc:
        raise self.retry(exc=exc)
