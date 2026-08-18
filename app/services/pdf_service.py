import base64
import io
import json
from datetime import datetime
from fpdf import FPDF
from PIL import Image
from app.models.user import User

class PDFService:
    @staticmethod
    def _display_name(user) -> str:
        """Best-effort display name for the sender / 'from' block.

        Prefers the profile/full name (the field edited under Settings →
        Profile) so a renamed sender always shows up on the PDF, and only
        falls back to the company name / defaults.
        """
        return (
            getattr(user, "full_name", None)
            or getattr(user, "name", None)
            or getattr(user, "company_name", None)
            or "My Business"
        )

    @staticmethod
    def _logo_meta(logo):
        """Decode a base64 data-URL logo into (io.BytesIO, img_w, img_h) or None."""
        if not logo or not isinstance(logo, str) or not logo.startswith("data:"):
            return None
        try:
            header, b64 = logo.split(",", 1)
            buf = io.BytesIO(base64.b64decode(b64))
            with Image.open(buf) as im:
                w, h = im.size
            buf.seek(0)
            return buf, w, h
        except Exception:
            return None

    @staticmethod
    def _render_logo(pdf, logo):
        """Render the sender logo (if any) at the current position, preserving aspect ratio."""
        meta = PDFService._logo_meta(logo)
        if not meta:
            return False
        buf, w_px, h_px = meta
        max_w = 55
        max_h = 20
        ratio = w_px / max(h_px, 1)
        if ratio >= max_w / max_h:
            box_w = max_w
            box_h = max_w / ratio
        else:
            box_h = max_h
            box_w = max_h * ratio
        pdf.image(buf, x=10, y=pdf.get_y(), w=box_w, h=box_h)
        pdf.set_y(pdf.get_y() + max_h + 2)
        return True

    @staticmethod
    def _items_list(items):
        """Normalize items to a list of dicts, tolerant of JSON strings / None."""
        if isinstance(items, str):
            try:
                items = json.loads(items)
            except Exception:
                items = []
        if not isinstance(items, list):
            items = []
        return [i for i in items if isinstance(i, dict)]

    @staticmethod
    def _line_total(item, qty, unit_price):
        """Per-item total: prefer a stored total, else compute qty * unit_price."""
        stored = item.get("total")
        if stored is not None:
            try:
                return float(stored)
            except (TypeError, ValueError):
                pass
        return qty * unit_price

    @staticmethod
    def generate_invoice_pdf(invoice_data: dict, user: User) -> bytes:
        """Generate a beautiful PDF invoice using FPDF."""
        pdf = FPDF(orientation="P", unit="mm", format="A4")
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=15)

        # Colors & Fonts
        primary_color = (59, 130, 246)  # Blue
        text_color = (30, 41, 59)       # Slate 800
        muted_color = (100, 116, 139)   # Slate 500

        # Company Header (Right)
        pdf.set_font("helvetica", "B", 24)
        pdf.set_text_color(*primary_color)
        pdf.cell(0, 15, "INVOICE", align="R", new_x="LMARGIN", new_y="NEXT")

        # PAID status stamp
        if str(invoice_data.get("status", "")).upper() == "PAID":
            pdf.set_font("helvetica", "B", 20)
            pdf.set_text_color(22, 163, 74)
            pdf.cell(0, 12, "PAID", align="R", new_x="LMARGIN", new_y="NEXT")
            pdf.set_text_color(*text_color)

        # Your Details (Left) — logo (avatar) if present, otherwise the business name
        logo = invoice_data.get("company_logo") or getattr(user, "avatar", None)
        if not PDFService._render_logo(pdf, logo):
            pdf.set_font("helvetica", "B", 14)
            pdf.set_text_color(*text_color)
            company_name = invoice_data.get("company_name") or PDFService._display_name(user)
            pdf.cell(100, 8, company_name, new_x="LMARGIN", new_y="NEXT")

        pdf.set_font("helvetica", "", 10)
        pdf.set_text_color(*muted_color)
        pdf.cell(100, 5, str(user.email or ""), new_x="LMARGIN", new_y="NEXT")
        
        # Use address from data/settings if available
        address = invoice_data.get("company_address") or getattr(user, "address", None)
        if address:
            pdf.cell(100, 5, str(address), new_x="LMARGIN", new_y="NEXT")
            
        vat = invoice_data.get("company_vat") or getattr(user, "vat_number", None)
        if vat:
            pdf.cell(100, 5, f"VAT No: {vat}", new_x="LMARGIN", new_y="NEXT")

        pdf.ln(10)

        # Invoice Info (Right aligned but positioned absolutely)
        pdf.set_font("helvetica", "B", 10)
        pdf.set_text_color(*text_color)
        pdf.set_xy(140, 35)
        pdf.cell(30, 5, "Invoice No:", align="R")
        pdf.set_font("helvetica", "", 10)
        pdf.cell(30, 5, invoice_data.get("invoice_number", "INV-0000"), align="R")
        
        pdf.set_xy(140, 40)
        pdf.set_font("helvetica", "B", 10)
        pdf.cell(30, 5, "Date:", align="R")
        pdf.set_font("helvetica", "", 10)
        pdf.cell(30, 5, str(invoice_data.get("issue_date", "")), align="R")

        pdf.set_xy(140, 45)
        pdf.set_font("helvetica", "B", 10)
        pdf.cell(30, 5, "Due Date:", align="R")
        pdf.set_font("helvetica", "", 10)
        pdf.cell(30, 5, str(invoice_data.get("due_date", "")), align="R")

        # Position client block below the from-section (logo may push it down)
        pdf.set_xy(10, max(pdf.get_y() + 5, 70))

        # Client Details (Left)
        pdf.set_font("helvetica", "B", 12)
        pdf.set_text_color(*text_color)
        pdf.cell(100, 8, "Bill To:", new_x="LMARGIN", new_y="NEXT")
        
        client = invoice_data.get("client", {})
        if not client: client = {}
        pdf.set_font("helvetica", "B", 10)
        pdf.cell(100, 5, str(client.get("name") or "Unknown Client"), new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("helvetica", "", 10)
        pdf.set_text_color(*muted_color)
        pdf.cell(100, 5, str(client.get("email") or ""), new_x="LMARGIN", new_y="NEXT")
        if client.get("address"):
            pdf.cell(100, 5, str(client.get("address")), new_x="LMARGIN", new_y="NEXT")

        pdf.ln(15)

        # Table Header
        pdf.set_fill_color(*primary_color)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("helvetica", "B", 10)
        pdf.cell(90, 10, " Description", border=0, fill=True)
        pdf.cell(30, 10, "Qty", align="C", border=0, fill=True)
        pdf.cell(35, 10, "Unit Price", align="R", border=0, fill=True)
        pdf.cell(35, 10, "Total", align="R", border=0, fill=True, new_x="LMARGIN", new_y="NEXT")

        # Table Rows
        pdf.set_text_color(*text_color)
        pdf.set_font("helvetica", "", 10)
        
        items = PDFService._items_list(invoice_data.get("items"))
        for item in items:
            qty = float(item.get("quantity", 0) or 0)
            unit_price = float(item.get("unit_price", item.get("unitPrice", item.get("price", 0))) or 0)
            line_total = PDFService._line_total(item, qty, unit_price)
            pdf.cell(90, 10, f" {item.get('description', '')}", border="B")
            pdf.cell(30, 10, str(item.get("quantity", 0)), align="C", border="B")
            pdf.cell(35, 10, f"${unit_price:.2f}", align="R", border="B")
            pdf.cell(35, 10, f"${line_total:.2f}", align="R", border="B", new_x="LMARGIN", new_y="NEXT")

        pdf.ln(10)

        # Totals (accept both camel/snake dict keys, e.g. model_dump() vs inv_data)
        subtotal = float(invoice_data.get("subtotal", invoice_data.get("subtotal_amount", 0)) or 0)
        tax_total = float(invoice_data.get("tax_total", invoice_data.get("tax_amount", 0)) or 0)
        total = float(invoice_data.get("total", invoice_data.get("total_amount", 0)) or 0)
        advance_payment = float(invoice_data.get("advance_payment", 0) or 0)

        pdf.set_x(120)
        pdf.set_font("helvetica", "", 10)
        pdf.cell(35, 8, "Subtotal:", align="R")
        pdf.cell(35, 8, f"${subtotal:.2f}", align="R", new_x="LMARGIN", new_y="NEXT")

        pdf.set_x(120)
        pdf.cell(35, 8, "Tax:", align="R")
        pdf.cell(35, 8, f"${tax_total:.2f}", align="R", new_x="LMARGIN", new_y="NEXT")

        pdf.set_x(120)
        pdf.set_font("helvetica", "B", 12)
        pdf.set_text_color(*primary_color)
        pdf.cell(35, 10, "Total:", align="R")
        pdf.cell(35, 10, f"${total:.2f}", align="R", new_x="LMARGIN", new_y="NEXT")

        if advance_payment > 0:
            pdf.set_font("helvetica", "", 10)
            pdf.set_text_color(*text_color)
            pdf.set_x(120)
            pdf.cell(35, 8, "Advance Paid:", align="R")
            pdf.cell(35, 8, f"${advance_payment:.2f}", align="R", new_x="LMARGIN", new_y="NEXT")
            pdf.set_x(120)
            pdf.set_font("helvetica", "B", 11)
            pdf.set_text_color(0, 128, 0)
            pdf.cell(35, 10, "Balance Due:", align="R")
            pdf.cell(35, 10, f"${max(total - advance_payment, 0):.2f}", align="R", new_x="LMARGIN", new_y="NEXT")

        # Notes
        notes = invoice_data.get("notes")
        if notes:
            pdf.ln(10)
            pdf.set_font("helvetica", "B", 10)
            pdf.set_text_color(*text_color)
            pdf.cell(0, 6, "Notes:", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("helvetica", "", 9)
            pdf.set_text_color(*muted_color)
            pdf.multi_cell(0, 5, str(notes))

        # Output bytes
        return bytes(pdf.output())

    @staticmethod
    def generate_quotation_pdf(quotation_data: dict, user: User) -> bytes:
        """Generate a beautiful PDF quotation using FPDF."""
        pdf = FPDF(orientation="P", unit="mm", format="A4")
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=15)

        # Colors & Fonts
        primary_color = (15, 23, 42)  # Dark Slate
        text_color = (30, 41, 59)      # Slate 800
        muted_color = (100, 116, 139)  # Slate 500

        # Company Header (Right)
        pdf.set_font("helvetica", "B", 24)
        pdf.set_text_color(*primary_color)
        pdf.cell(0, 15, "QUOTATION", align="R", new_x="LMARGIN", new_y="NEXT")

        # Your Details (Left) — logo (avatar) if present, otherwise the business name
        logo = quotation_data.get("company_logo") or getattr(user, "avatar", None)
        if not PDFService._render_logo(pdf, logo):
            pdf.set_font("helvetica", "B", 14)
            pdf.set_text_color(*text_color)
            company_name = quotation_data.get("company_name") or PDFService._display_name(user)
            pdf.cell(100, 8, company_name, new_x="LMARGIN", new_y="NEXT")

        pdf.set_font("helvetica", "", 10)
        pdf.set_text_color(*muted_color)
        pdf.cell(100, 5, str(user.email or ""), new_x="LMARGIN", new_y="NEXT")
        
        # Use address from data/settings if available
        address = quotation_data.get("company_address") or getattr(user, "address", None)
        if address:
            pdf.cell(100, 5, str(address), new_x="LMARGIN", new_y="NEXT")
            
        vat = quotation_data.get("company_vat") or getattr(user, "vat_number", None)
        if vat:
            pdf.cell(100, 5, f"VAT No: {vat}", new_x="LMARGIN", new_y="NEXT")

        pdf.ln(10)

        # Quotation Info (Right aligned but positioned absolutely)
        pdf.set_font("helvetica", "B", 10)
        pdf.set_text_color(*text_color)
        pdf.set_xy(140, 35)
        pdf.cell(30, 5, "Quotation No:", align="R")
        pdf.set_font("helvetica", "", 10)
        pdf.cell(30, 5, quotation_data.get("quotation_number", "QUO-0000"), align="R")
        
        pdf.set_xy(140, 40)
        pdf.set_font("helvetica", "B", 10)
        pdf.cell(30, 5, "Date:", align="R")
        pdf.set_font("helvetica", "", 10)
        pdf.cell(30, 5, str(quotation_data.get("issue_date", "")), align="R")

        pdf.set_xy(140, 45)
        pdf.set_font("helvetica", "B", 10)
        pdf.cell(30, 5, "Valid Until:", align="R")
        pdf.set_font("helvetica", "", 10)
        pdf.cell(30, 5, str(quotation_data.get("expiry_date", "")), align="R")

        # Position client block below the from-section (logo may push it down)
        pdf.set_xy(10, max(pdf.get_y() + 5, 70))

        # Client Details (Left)
        pdf.set_font("helvetica", "B", 12)
        pdf.set_text_color(*text_color)
        pdf.cell(100, 8, "For Client:", new_x="LMARGIN", new_y="NEXT")
        
        client = quotation_data.get("client", {})
        if not client: client = {}
        pdf.set_font("helvetica", "B", 10)
        pdf.cell(100, 5, str(client.get("name") or "Unknown Client"), new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("helvetica", "", 10)
        pdf.set_text_color(*muted_color)
        pdf.cell(100, 5, str(client.get("email") or ""), new_x="LMARGIN", new_y="NEXT")
        if client.get("address"):
            pdf.cell(100, 5, str(client.get("address")), new_x="LMARGIN", new_y="NEXT")

        pdf.ln(15)

        # Table Header
        pdf.set_fill_color(*primary_color)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("helvetica", "B", 10)
        pdf.cell(90, 10, " Description", border=0, fill=True)
        pdf.cell(30, 10, "Qty", align="C", border=0, fill=True)
        pdf.cell(35, 10, "Unit Price", align="R", border=0, fill=True)
        pdf.cell(35, 10, "Total", align="R", border=0, fill=True, new_x="LMARGIN", new_y="NEXT")

        # Table Rows
        pdf.set_text_color(*text_color)
        pdf.set_font("helvetica", "", 10)
        
        items = PDFService._items_list(quotation_data.get("items"))
        for item in items:
            qty = float(item.get("quantity", 0) or 0)
            unit_price = float(item.get("unit_price", item.get("unitPrice", item.get("price", 0))) or 0)
            line_total = PDFService._line_total(item, qty, unit_price)
            pdf.cell(90, 10, f" {item.get('description', '')}", border="B")
            pdf.cell(30, 10, str(item.get("quantity", 0)), align="C", border="B")
            pdf.cell(35, 10, f"${unit_price:.2f}", align="R", border="B")
            pdf.cell(35, 10, f"${line_total:.2f}", align="R", border="B", new_x="LMARGIN", new_y="NEXT")

        pdf.ln(10)

        # Totals
        subtotal = float(quotation_data.get("subtotal_amount", 0))
        tax_total = float(quotation_data.get("tax_amount", 0))
        total = float(quotation_data.get("total_amount", 0))

        pdf.set_x(120)
        pdf.set_font("helvetica", "", 10)
        pdf.cell(35, 8, "Subtotal:", align="R")
        pdf.cell(35, 8, f"${subtotal:.2f}", align="R", new_x="LMARGIN", new_y="NEXT")

        pdf.set_x(120)
        pdf.cell(35, 8, "Tax:", align="R")
        pdf.cell(35, 8, f"${tax_total:.2f}", align="R", new_x="LMARGIN", new_y="NEXT")

        pdf.set_x(120)
        pdf.set_font("helvetica", "B", 12)
        pdf.set_text_color(*primary_color)
        pdf.cell(35, 10, "Total Estimate:", align="R")
        pdf.cell(35, 10, f"${total:.2f}", align="R", new_x="LMARGIN", new_y="NEXT")

        # Notes
        notes = quotation_data.get("notes")
        if notes:
            pdf.ln(10)
            pdf.set_font("helvetica", "B", 10)
            pdf.set_text_color(*text_color)
            pdf.cell(0, 6, "Notes:", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("helvetica", "", 9)
            pdf.set_text_color(*muted_color)
            pdf.multi_cell(0, 5, str(notes))

        return bytes(pdf.output())

    @staticmethod
    def generate_report_pdf(report_data: dict, user: User, title: str) -> bytes:
        """Generate a basic financial report PDF."""
        pdf = FPDF()
        pdf.add_page()
        pdf.set_font("helvetica", "B", 20)
        pdf.cell(0, 15, title, align="C", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("helvetica", "", 12)
        pdf.cell(0, 10, f"Generated for: {user.company_name or user.name}", align="C", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 10, f"Date: {datetime.now().strftime('%Y-%m-%d')}", align="C", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(10)
        
        pdf.set_font("helvetica", "", 11)
        for key, value in report_data.items():
            if isinstance(value, (int, float)):
                pdf.cell(0, 8, f"{key.replace('_', ' ').title()}: ${value:,.2f}", new_x="LMARGIN", new_y="NEXT")
            else:
                pdf.cell(0, 8, f"{key.replace('_', ' ').title()}: {value}", new_x="LMARGIN", new_y="NEXT")
                
        return bytes(pdf.output())
