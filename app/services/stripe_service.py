import stripe
from app.models.payment import PaymentSettings
from app.core.encryption import decrypt_value
from typing import Optional

class StripeService:
    def __init__(self, settings: PaymentSettings):
        # Try to decrypt if it looks encrypted, otherwise use raw
        def safe_decrypt(val):
            if not val: return None
            try:
                return decrypt_value(val)
            except Exception:
                return val # Return raw if decryption fails (e.g. from .env)

        self.api_key = safe_decrypt(settings.stripe_secret_key)
        self.webhook_secret = safe_decrypt(settings.stripe_webhook_secret)
        self.stripe_account_id = settings.stripe_account_id

    def create_checkout_session(self, doc, success_url: str, cancel_url: str):
        try:
            # If we have a connected account ID, we use it to route the payment directly to them
            stripe_kwargs = {
                "api_key": self.api_key
            }
            if self.stripe_account_id:
                stripe_kwargs["stripe_account"] = self.stripe_account_id

            # Determine if it's an invoice or quotation for the description
            doc_type = "Invoice" if hasattr(doc, 'invoice_number') else "Quotation"
            doc_num = getattr(doc, 'invoice_number', getattr(doc, 'quotation_number', 'Unknown'))

            # Safely handle total_amount conversion
            raw_amount = doc.total_amount
            if isinstance(raw_amount, str):
                # Remove commas and currency symbols if any
                raw_amount = raw_amount.replace(',', '').replace('£', '').replace('$', '').replace('€', '').strip()
            
            try:
                amount_cents = int(float(raw_amount) * 100)
            except (ValueError, TypeError, AttributeError):
                print(f"⚠️ Invalid amount for Stripe: {raw_amount}")
                return None

            session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': str(doc.currency or "gbp").lower(),
                        'product_data': {
                            'name': f"{doc_type} {doc_num}",
                        },
                        'unit_amount': amount_cents,
                    },
                    'quantity': 1,
                }],
                mode='payment',
                success_url=success_url,
                cancel_url=cancel_url,
                metadata={
                    'doc_id': str(doc.id),
                    'doc_type': doc_type.lower(),
                    'user_id': str(doc.user_id)
                },
                **stripe_kwargs
            )
            return session
        except Exception as e:
            print(f"❌ Stripe Error: {str(e)}")
            return None

    def verify_webhook(self, payload: str, sig_header: str) -> Optional[stripe.Event]:
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, self.webhook_secret,
                api_key=self.api_key
            )
            return event
        except Exception:
            return None
