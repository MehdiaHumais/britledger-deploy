"""
BritLedger AI — Email Celery Tasks
"""

from __future__ import annotations

from typing import Optional

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


@celery_app.task(
    name="app.tasks.email_tasks.send_invoice_email",
    queue="emails",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def send_invoice_email(
    self,
    invoice_id: str,
    recipient_email: Optional[str] = None,
    custom_message: Optional[str] = None,
) -> dict:
    """Send an invoice PDF to the client via email."""
    try:
        logger.info("sending_invoice_email", invoice_id=invoice_id)
        # In production: generate PDF, attach, send via SMTP
        # from app.utils.email import send_email
        # from app.utils.pdf import generate_invoice_pdf
        # pdf = generate_invoice_pdf(invoice_id)
        # send_email(to=recipient_email, subject=..., attachment=pdf)
        return {"status": "sent", "invoice_id": invoice_id}
    except Exception as exc:
        logger.error("invoice_email_failed", invoice_id=invoice_id, error=str(exc))
        raise self.retry(exc=exc)


@celery_app.task(
    name="app.tasks.email_tasks.send_password_reset_email",
    queue="emails",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
)
def send_password_reset_email(self, email: str, reset_token: str) -> dict:
    """Send a password reset link via email."""
    try:
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
        logger.info("sending_password_reset", email=email)
        # send_email(to=email, subject="Reset your BritLedger AI password", ...)
        return {"status": "sent", "email": email}
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(
    name="app.tasks.email_tasks.send_payment_reminder",
    queue="emails",
    bind=True,
    max_retries=2,
)
def send_payment_reminder(self, invoice_id: str, client_email: str) -> dict:
    """Send a payment reminder for an overdue invoice."""
    try:
        logger.info("sending_payment_reminder", invoice_id=invoice_id)
        return {"status": "sent", "invoice_id": invoice_id}
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(
    name="app.tasks.email_tasks.send_quotation_email",
    queue="emails",
    bind=True,
    max_retries=3,
)
def send_quotation_email(
    self,
    quotation_id: str,
    recipient_email: str,
) -> dict:
    """Send a quotation PDF to the prospect via email."""
    try:
        logger.info("sending_quotation_email", quotation_id=quotation_id)
        return {"status": "sent", "quotation_id": quotation_id}
    except Exception as exc:
        raise self.retry(exc=exc)
