import resend
import os
import html as html_mod
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from typing import List, Optional

from app.core.config import settings

def resolve_avatar_url(avatar, user_id):
    """Convert a base64 data-URL avatar into a public URL that email clients can load."""
    if not avatar:
        return None
    if avatar.startswith("data:"):
        base = os.getenv("PUBLIC_API_URL") or getattr(settings, "PUBLIC_API_URL", "https://ledger.britsyncai.com")
        return f"{base.rstrip('/')}/api/v1/users/{user_id}/avatar"
    return avatar

class EmailService:
    def __init__(self):
        resend.api_key = settings.EMAIL_API_KEY

    @property
    def smtp_configured(self) -> bool:
        return all([
            settings.SMTP_HOST,
            settings.SMTP_USERNAME,
            settings.SMTP_PASSWORD,
        ])

    def _send_via_smtp(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: str,
        from_email: str,
        from_name: str,
        attachments: Optional[List[dict]] = None,
        reply_to: Optional[str] = None,
    ):
        if not self.smtp_configured:
            return None, "SMTP not configured (set SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD)"

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = to_email
        if reply_to:
            msg["Reply-To"] = reply_to

        if text_content:
            msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        if attachments:
            for att in attachments:
                content = att.get("content")
                if isinstance(content, str):
                    try:
                        import base64
                        content = base64.b64decode(content)
                    except:
                        content = content.encode("utf-8")
                if isinstance(content, (list, tuple)):
                    content = bytes(content) if isinstance(content, list) else bytes(content)
                if isinstance(content, (bytes, bytearray)):
                    part = MIMEBase("application", "octet-stream")
                    part.set_payload(bytes(content))
                    encoders.encode_base64(part)
                    part.add_header(
                        "Content-Disposition",
                        "attachment",
                        filename=att.get("filename", "attachment.pdf"),
                    )
                    msg.attach(part)

        try:
            context = ssl.create_default_context()
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30)
            server.ehlo()
            if settings.SMTP_USE_TLS:
                server.starttls(context=context)
                server.ehlo()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.sendmail(from_email, [to_email], msg.as_string())
            server.quit()
            print(f"[EMAIL_SUCCESS] SMTP email sent to {to_email}")
            return {"id": f"smtp:{to_email}"}, None
        except Exception as e:
            error_msg = str(e)
            print(f"[EMAIL_ERROR_SMTP] {error_msg}")
            return None, error_msg

    def _send_via_resend(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: str,
        from_email: str,
        from_name: str,
        attachments: Optional[List[dict]] = None,
        reply_to: Optional[str] = None,
    ):
        processed_attachments = []
        if attachments:
            for att in attachments:
                content = att.get("content")
                if isinstance(content, str):
                    try:
                        import base64
                        content = base64.b64decode(content)
                    except:
                        pass

                if isinstance(content, (bytes, bytearray)):
                    content = list(content)

                processed_attachments.append({
                    "filename": att.get("filename"),
                    "content": content
                })

        params = {
            "from": f"{from_name} <{from_email}>",
            "to": [to_email],
            "subject": subject,
            "html": html_content,
            "text": text_content,
        }
        if reply_to:
            params["reply_to"] = [reply_to]
        if processed_attachments:
            params["attachments"] = processed_attachments

        try:
            result = resend.Emails.send(params)
            print(f"[EMAIL_SUCCESS] Resend ID: {getattr(result, 'id', result)}")
            return result, None
        except Exception as e:
            error_msg = str(e)
            print(f"[EMAIL_ERROR] {error_msg}")
            return None, error_msg

    @staticmethod
    def _html_notes(notes):
        """Escape notes and preserve line breaks for HTML email bodies."""
        if not notes:
            return ""
        text = html_mod.escape(str(notes))
        return text.replace("\r\n", "\n").replace("\n", "<br/>")

    def send_invoice_email(
        self, 
        to_email: str, 
        subject: str, 
        html_content: str, 
        attachments: Optional[List[dict]] = None,
        reply_to: Optional[str] = None,
    ):
        resend.api_key = settings.EMAIL_API_KEY
        
        from_name = getattr(settings, "COMPANY_NAME", None) or settings.APP_NAME 
        from_email = settings.SENDER_EMAIL or "onboarding@resend.dev"

        if from_name and " from " not in subject.lower() and from_name not in subject:
            subject = f"{subject} from {from_name}"
        personalized_subject = subject

        from bs4 import BeautifulSoup
        try:
            soup = BeautifulSoup(html_content, "html.parser")
            text_content = soup.get_text(separator="\n")
        except:
            text_content = "Professional Invoice from BritLedger AI. Please check the attached PDF."

        print(f"[EMAIL_PERSONALIZED] Sending: {personalized_subject}")
        
        result, error = self._send_via_smtp(
            to_email=to_email,
            subject=personalized_subject,
            html_content=html_content,
            text_content=text_content,
            from_email=from_email,
            from_name=from_name,
            attachments=attachments,
            reply_to=reply_to,
        )
        if result is not None:
            return result, None

        return self._send_via_resend(
            to_email=to_email,
            subject=personalized_subject,
            html_content=html_content,
            text_content=text_content,
            from_email=from_email,
            from_name=from_name,
            attachments=attachments,
            reply_to=reply_to,
        )

    def send_password_reset_email(self, to_email: str, reset_token: str) -> tuple:
        """Send a password reset link via SMTP (primary) or Resend (fallback)."""
        resend.api_key = settings.EMAIL_API_KEY
        base = os.getenv("FRONTEND_URL") or getattr(settings, "FRONTEND_URL", "https://ledger.britsyncai.com")
        reset_url = f"{base.rstrip('/')}/reset-password?token={reset_token}"
        from_name = getattr(settings, "COMPANY_NAME", None) or settings.APP_NAME
        from_email = settings.SENDER_EMAIL or "onboarding@resend.dev"

        subject = "Reset your BritLedger AI password"
        html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc;">
            <div style="background-color: #f8fafc; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <div style="background-color: #2563eb; padding: 40px 20px; text-align: center; color: #ffffff;">
                        <h1 style="margin: 0; font-size: 28px; letter-spacing: -0.025em;">BritLedger AI</h1>
                    </div>
                    <div style="padding: 40px;">
                        <h2 style="margin-top: 0; font-size: 20px;">Reset your password</h2>
                        <p>We received a request to reset your password for your BritLedger AI account.</p>
                        <p>Click the button below to choose a new password. This link expires in 15 minutes.</p>
                        <div style="text-align: center; margin: 32px 0;">
                            <a href="{reset_url}" style="display: inline-block; padding: 16px 32px; background-color: #2563eb; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 700;">Reset Password</a>
                        </div>
                        <p style="color: #64748b; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
                        <p style="color: #2563eb; font-size: 14px; word-break: break-all;">{reset_url}</p>
                        <p style="color: #64748b; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
                    </div>
                    <div style="padding: 32px; text-align: center; font-size: 13px; color: #64748b; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                        <p style="margin: 0;">&copy; 2026 BritLedger AI. All rights reserved.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        text = (
            "Reset your BritLedger AI password\n\n"
            "We received a request to reset your password for your BritLedger AI account.\n\n"
            f"Click the link below to choose a new password (expires in 15 minutes):\n\n"
            f"{reset_url}\n\n"
            "If you didn't request this, you can safely ignore this email."
        )
        print(f"[RESET_LINK] {reset_url}", flush=True)
        result, error = self._send_via_smtp(
            to_email=to_email,
            subject=subject,
            html_content=html,
            text_content=text,
            from_email=from_email,
            from_name=from_name,
        )
        if result is not None:
            print(f"[EMAIL_SUCCESS] Password reset email sent to {to_email}")
            return result, None

        try:
            result, error = self._send_via_resend(
                to_email=to_email,
                subject=subject,
                html_content=html,
                text_content=text,
                from_email=from_email,
                from_name=from_name,
            )
            print(f"[EMAIL_SUCCESS] Password reset email sent to {to_email}")
            return result, None
        except Exception as e:
            error_msg = str(e)
            print(f"[EMAIL_ERROR] Password reset send failed: {error_msg}")
            return None, error_msg

    def _generate_items_table(self, items, currency="GBP"):
        if not items:
            return ""
        
        # Handle cases where items might be a JSON string
        if isinstance(items, str):
            try:
                import json
                items = json.loads(items)
            except:
                return ""

        rows = ""
        for item in (items or []):
            desc = item.get("description", "Service") if isinstance(item, dict) else getattr(item, "description", "Service")
            qty = item.get("quantity", 1) if isinstance(item, dict) else getattr(item, "quantity", 1)
            price = item.get("unit_price", 0) if isinstance(item, dict) else getattr(item, "unit_price", 0)
            total = float(qty) * float(price)
            
            rows += f"""
            <tr>
                <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px;">{desc}</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; text-align: center;">{qty}</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; text-align: right;">{currency} {price:,.2f}</td>
                <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; text-align: right; font-weight: 600;">{currency} {total:,.2f}</td>
            </tr>
            """
        
        return f"""
        <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
            <thead>
                <tr style="border-bottom: 2px solid #e2e8f0;">
                    <th style="text-align: left; padding-bottom: 12px; font-size: 12px; color: #64748b; text-transform: uppercase;">Description</th>
                    <th style="text-align: center; padding-bottom: 12px; font-size: 12px; color: #64748b; text-transform: uppercase;">Qty</th>
                    <th style="text-align: right; padding-bottom: 12px; font-size: 12px; color: #64748b; text-transform: uppercase;">Price</th>
                    <th style="text-align: right; padding-bottom: 12px; font-size: 12px; color: #64748b; text-transform: uppercase;">Total</th>
                </tr>
            </thead>
            <tbody>
                {rows}
            </tbody>
        </table>
        """

    def get_invoice_html(self, invoice, company_settings, payment_links, sender_email=None, sender_name=None, sender_logo=None):
        stripe_link = payment_links.get("stripe")
        items_html = self._generate_items_table(getattr(invoice, "items", []), getattr(invoice, "currency", "GBP"))
        total = float(invoice.total_amount or 0)
        advance = float(getattr(invoice, "advance_payment", None) or 0)
        balance = max(total - advance, 0)
        is_paid = str(getattr(invoice, "status", None)).upper() == "PAID"

        status_badge = ""
        if is_paid:
            status_badge = """<div style="display:inline-block; background-color:#dcfce7; color:#166534; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:6px 14px; border-radius:99px; margin-bottom:16px;">&#10003; Paid</div>"""
        advance_block = ""
        if advance > 0:
            advance_block = f"""<div style="margin-top: 16px; font-size: 14px;"><strong>Total Amount:</strong> {invoice.currency} {total:,.2f}</div>
                            <div style="margin-top: 8px; font-size: 14px;"><strong>Advance Paid:</strong> {invoice.currency} {advance:,.2f}</div>
                            <div style="margin-top: 8px; font-size: 16px; font-weight: 700; color: #16a34a;"><strong>Balance Due:</strong> {invoice.currency} {balance:,.2f}</div>"""
        if is_paid:
            due_label = "Total Paid"
            due_amount = total
            message = "Thank you! This invoice has been paid in full. No further payment is required."
            pay_button = ""
        else:
            due_label = "Balance Due" if advance > 0 else "Total Amount Due"
            due_amount = balance if advance > 0 else total
            message = "Hi there, here is your invoice. You can pay securely using the button below or review the attached PDF for a full breakdown."
            pay_button = f'<a href="{stripe_link}" class="button">Pay Securely Online</a>' if stripe_link else ''
        sender_logo_html = ""
        if sender_logo:
            sender_logo_html = f'<img src="{sender_logo}" alt="Logo" style="max-height:48px; max-width:180px; object-fit:contain; display:block; margin:6px 0;" />'
        sender_block = f"""<div style="background-color: #eef2ff; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #2563eb;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Sent By</div>
            {sender_logo_html}
            <div style="font-size: 16px; font-weight: 600; color: #1e293b; margin-top: 4px;">{sender_name or 'BritLedger AI'}</div>
            <div style="font-size: 14px; color: #2563eb; margin-top: 2px;">{sender_email or ''}</div>
        </div>""" if sender_email else ""
        notes_html = self._html_notes(getattr(invoice, "notes", None))

        return f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Invoice {invoice.invoice_number}</title>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }}
                .wrapper {{ background-color: #f8fafc; padding: 20px; }}
                .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }}
                .header {{ background-color: #2563eb; padding: 40px 20px; text-align: center; color: #ffffff; }}
                .content {{ padding: 40px; }}
                .invoice-card {{ background-color: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0; }}
                .amount {{ font-size: 32px; font-weight: 800; color: #0f172a; margin-top: 8px; }}
                .button {{ display: block; padding: 16px 32px; background-color: #2563eb; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 700; text-align: center; margin: 32px 0; }}
                .footer {{ padding: 32px; text-align: center; font-size: 13px; color: #64748b; background-color: #f8fafc; border-top: 1px solid #e2e8f0; }}
            </style>
        </head>
        <body>
            <div class="wrapper">
                <div class="container">
                    <div class="header">
                        <h1 style="margin: 0; font-size: 28px; letter-spacing: -0.025em;">BritLedger AI</h1>
                    </div>
                    <div class="content">
                        {sender_block}
                        {status_badge}
                        <h2 style="margin-top: 0; font-size: 20px;">Invoice Received</h2>
                        <p>{message}</p>
                        
                        {items_html}
                        
                        <div class="invoice-card">
                            <div style="font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">{due_label}</div>
                            <div class="amount">{invoice.currency} {due_amount:,.2f}</div>
                            <div style="margin-top: 16px; font-size: 14px;"><strong>Invoice:</strong> {invoice.invoice_number}</div>
                            <div style="font-size: 14px;"><strong>Due Date:</strong> {invoice.due_date or 'On Receipt'}</div>
                            {advance_block}
                        </div>
                        
                        {pay_button}
                        
                        {f'<div style="margin-top: 24px; font-size: 14px; color: #475569;"><strong>Notes:</strong><br/>{notes_html}</div>' if notes_html else ''}
                    </div>
                    <div class="footer">
                        <p><strong>{sender_name or (company_settings.account_name if company_settings else 'BritLedger AI')}</strong></p>
                        <p>{company_settings.company_address if company_settings else ''}</p>
                        <p style="margin-top: 16px;">&copy; 2026 BritLedger AI. All rights reserved.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """

    def get_quotation_html(self, quotation, company_settings, payment_links=None, sender_email=None, sender_name=None, sender_logo=None):
        stripe_link = (payment_links or {}).get("stripe")
        items_html = self._generate_items_table(getattr(quotation, "items", []), getattr(quotation, "currency", "GBP"))
        sender_logo_html = ""
        if sender_logo:
            sender_logo_html = f'<img src="{sender_logo}" alt="Logo" style="max-height:48px; max-width:180px; object-fit:contain; display:block; margin:6px 0;" />'
        sender_block = f"""<div style="background-color: #eef2ff; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #6366f1;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Sent By</div>
            {sender_logo_html}
            <div style="font-size: 16px; font-weight: 600; color: #1e293b; margin-top: 4px;">{sender_name or 'BritLedger AI'}</div>
            <div style="font-size: 14px; color: #6366f1; margin-top: 2px;">{sender_email or ''}</div>
        </div>""" if sender_email else ""
        notes_html = self._html_notes(getattr(quotation, "notes", None))

        return f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }}
                .wrapper {{ background-color: #f8fafc; padding: 20px; }}
                .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }}
                .header {{ background-color: #0f172a; padding: 40px 20px; text-align: center; color: #ffffff; }}
                .content {{ padding: 40px; }}
                .invoice-card {{ background-color: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0; }}
                .amount {{ font-size: 32px; font-weight: 800; color: #0f172a; margin-top: 8px; }}
                .button {{ display: block; padding: 16px 32px; background-color: #6366f1; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 700; text-align: center; margin: 32px 0; }}
                .footer {{ padding: 32px; text-align: center; font-size: 13px; color: #64748b; background-color: #f8fafc; border-top: 1px solid #e2e8f0; }}
            </style>
        </head>
        <body>
            <div class="wrapper">
                <div class="container">
                    <div class="header">
                        <h1 style="margin: 0; font-size: 28px;">BritLedger AI</h1>
                    </div>
                    <div class="content">
                        {sender_block}
                        <h2 style="margin-top: 0; font-size: 20px;">New Quotation</h2>
                        <p>We are pleased to provide you with the following quotation. Review the details below or check the attached PDF.</p>
                        
                        {items_html}
                        
                        <div class="invoice-card">
                            <div style="font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Estimated Total</div>
                            <div class="amount">{quotation.currency} {quotation.total_amount:,.2f}</div>
                            <div style="margin-top: 16px; font-size: 14px;"><strong>Quotation:</strong> {quotation.quotation_number}</div>
                            <div style="font-size: 14px;"><strong>Valid Until:</strong> {quotation.expiry_date or 'N/A'}</div>
                        </div>
                        
                        {f'<a href="{stripe_link}" class="button">Accept & Approve Quotation</a>' if stripe_link else ''}
                        
                        {f'<div style="margin-top: 24px; font-size: 14px; color: #475569;"><strong>Notes / Terms:</strong><br/>{notes_html}</div>' if notes_html else ''}
                    </div>
                    <div class="footer">
                        <p><strong>{sender_name or (company_settings.account_name if company_settings else 'BritLedger AI')}</strong></p>
                        <p>{company_settings.company_address if company_settings else ''}</p>
                        <p style="margin-top: 16px;">&copy; 2026 BritLedger AI. All rights reserved.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
