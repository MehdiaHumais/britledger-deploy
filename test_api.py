import urllib.request
import urllib.error
import json

req = urllib.request.Request(
    'http://localhost:8000/api/v1/invoices/export/pdf',
    data=json.dumps({"invoice_number": "123"}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
try:
    response = urllib.request.urlopen(req)
    print(response.status)
except urllib.error.HTTPError as e:
    print("HTTP ERROR:", e.code)
    print(e.read().decode('utf-8'))
except Exception as e:
    print("ERROR:", e)
