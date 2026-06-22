from app.services.pdf_service import PDFService
class DummyUser:
    email = 'test@example.com'
    company_name = 'Test Corp'
    address = ''
    vat_number = ''
    name = 'Test User'

try:
    PDFService.generate_invoice_pdf({'invoice_number':'123','issue_date':'2024','items':[]}, DummyUser())
    print("SUCCESS")
except Exception as e:
    import traceback
    traceback.print_exc()
