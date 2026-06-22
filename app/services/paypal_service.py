import httpx
from app.models.payment import PaymentSettings
from app.core.encryption import decrypt_value
from typing import Optional

class PayPalService:
    def __init__(self, settings: PaymentSettings):
        self.client_id = settings.paypal_client_id
        self.client_secret = decrypt_value(settings.paypal_client_secret)
        self.base_url = "https://api-m.sandbox.paypal.com" # Use sandbox for now

    async def get_access_token(self) -> Optional[str]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/v1/oauth2/token",
                auth=(self.client_id, self.client_secret),
                data={"grant_type": "client_credentials"},
            )
            if response.status_code == 200:
                return response.json().get("access_token")
            return None

    async def create_order(self, invoice, return_url: str, cancel_url: str):
        token = await self.get_access_token()
        if not token:
            return None
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        
        payload = {
            "intent": "CAPTURE",
            "purchase_units": [{
                "amount": {
                    "currency_code": invoice.currency,
                    "value": str(invoice.total_amount)
                },
                "reference_id": str(invoice.id)
            }],
            "application_context": {
                "return_url": return_url,
                "cancel_url": cancel_url
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/v2/checkout/orders",
                headers=headers,
                json=payload
            )
            return response.json()
