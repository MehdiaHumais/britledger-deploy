import resend
import os
from typing import List, Optional

from app.core.config import settings

class EmailService:
    def __init__(self):
        resend.api_key = settings.EMAIL_API_KEY

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

        personalized_subject = f"{subject} from {from_name}" if from_name not in subject else subject

        from bs4 import BeautifulSoup
        try:
            soup = BeautifulSoup(html_content, "html.parser")
            text_content = soup.get_text(separator="\n")
        except:
            text_content = "Professional Invoice from BritLedger AI. Please check the attached PDF."

        print(f"[EMAIL_PERSONALIZED] Sending: {personalized_subject}")
        
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
            "subject": personalized_subject,
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

    def get_invoice_html(self, invoice, company_settings, payment_links, sender_email=None, sender_name=None):
        stripe_link = payment_links.get("stripe")
        items_html = self._generate_items_table(getattr(invoice, "items", []), getattr(invoice, "currency", "GBP"))
        sender_block = f"""<div style="background-color: #eef2ff; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #2563eb;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Sent By</div>
            <div style="font-size: 16px; font-weight: 600; color: #1e293b; margin-top: 4px;">{sender_name or 'BritLedger AI'}</div>
            <div style="font-size: 14px; color: #2563eb; margin-top: 2px;">{sender_email or ''}</div>
        </div>""" if sender_email else ""

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
                        <h2 style="margin-top: 0; font-size: 20px;">Invoice Received</h2>
                        <p>Hi there, here is your invoice. You can pay securely using the button below or review the attached PDF for a full breakdown.</p>
                        
                        {items_html}
                        
                        <div class="invoice-card">
                            <div style="font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Total Amount Due</div>
                            <div class="amount">{invoice.currency} {invoice.total_amount:,.2f}</div>
                            <div style="margin-top: 16px; font-size: 14px;"><strong>Invoice:</strong> {invoice.invoice_number}</div>
                            <div style="font-size: 14px;"><strong>Due Date:</strong> {invoice.due_date or 'On Receipt'}</div>
                        </div>
                        
                        {f'<a href="{stripe_link}" class="button">Pay Securely Online</a>' if stripe_link else ''}
                        
                        {f'<div style="margin-top: 24px; font-size: 14px; color: #475569;"><strong>Notes:</strong><br/>{invoice.notes}</div>' if invoice.notes else ''}
                    </div>
                    <div class="footer">
                        <p><strong>{company_settings.account_name if company_settings else 'BritLedger AI'}</strong></p>
                        <p>{company_settings.company_address if company_settings else ''}</p>
                        <p style="margin-top: 16px;">&copy; 2026 BritLedger AI. All rights reserved.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """

    def get_quotation_html(self, quotation, company_settings, payment_links=None, sender_email=None, sender_name=None):
        stripe_link = (payment_links or {}).get("stripe")
        items_html = self._generate_items_table(getattr(quotation, "items", []), getattr(quotation, "currency", "GBP"))
        sender_block = f"""<div style="background-color: #eef2ff; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #6366f1;">
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Sent By</div>
            <div style="font-size: 16px; font-weight: 600; color: #1e293b; margin-top: 4px;">{sender_name or 'BritLedger AI'}</div>
            <div style="font-size: 14px; color: #6366f1; margin-top: 2px;">{sender_email or ''}</div>
        </div>""" if sender_email else ""

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
                        
                        {f'<div style="margin-top: 24px; font-size: 14px; color: #475569;"><strong>Notes / Terms:</strong><br/>{quotation.notes}</div>' if getattr(quotation, 'notes', None) else ''}
                    </div>
                    <div class="footer">
                        <p><strong>{company_settings.account_name if company_settings else 'BritLedger AI'}</strong></p>
                        <p>{company_settings.company_address if company_settings else ''}</p>
                        <p style="margin-top: 16px;">&copy; 2026 BritLedger AI. All rights reserved.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
