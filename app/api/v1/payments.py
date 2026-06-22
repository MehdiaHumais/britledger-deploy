from fastapi import APIRouter, Request, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.dependencies import get_current_user
from app.services.payment_service import payment_service
from app.services.stripe_service import StripeService
from app.services.paypal_service import PayPalService
from app.schemas.payment import PaymentSettingsRead, PaymentSettingsUpdate, PaymentSessionCreate
from app.models.invoice import Invoice
from app.models.payment import PaymentProvider
from app.models.user import User
from app.core.config import settings
import json

router = APIRouter(prefix="/payments", tags=["Payments"])

@router.get("/stripe/authorize")
async def stripe_authorize(current_user: User = Depends(get_current_user)):
    """Generate Stripe OAuth URL for business owners."""
    if not settings.STRIPE_CLIENT_ID:
        raise HTTPException(status_code=400, detail="Stripe Connect is not configured (missing Client ID)")
        
    from urllib.parse import quote
    # Hardcoded and encoded to ensure Stripe accepts it
    raw_redirect_uri = "http://localhost:3000/settings?tab=payments&stripe=callback"
    encoded_redirect_uri = quote(raw_redirect_uri, safe='')
    
    url = (
        f"https://connect.stripe.com/oauth/authorize"
        f"?response_type=code"
        f"&client_id={settings.STRIPE_CLIENT_ID}"
        f"&scope=read_write"
        f"&redirect_uri={encoded_redirect_uri}"
        f"&state={current_user.id}"
    )
    return {"url": url}

@router.get("/stripe/callback")
async def stripe_callback(code: str, state: str, db: AsyncSession = Depends(get_db)):
    """Handle Stripe OAuth callback and save the account ID."""
    import stripe
    stripe.api_key = settings.STRIPE_SECRET_KEY
    
    try:
        response = stripe.OAuth.token(
            grant_type="authorization_code",
            code=code,
        )
        stripe_user_id = response.get("stripe_user_id")
        
        # Save to database
        await payment_service.update_settings(db, state, {
            "stripe_account_id": stripe_user_id,
            "stripe_enabled": True
        })
        
        return {"success": True, "stripe_user_id": stripe_user_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/settings", response_model=PaymentSettingsRead)
async def get_payment_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    settings = await payment_service.get_settings(db, current_user.id)
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    return settings

@router.post("/settings", response_model=PaymentSettingsRead)
async def update_payment_settings(
    settings_in: PaymentSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    settings = await payment_service.update_settings(db, current_user.id, settings_in.dict(exclude_unset=True))
    return settings

@router.post("/create-session")
async def create_payment_session(
    session_in: PaymentSessionCreate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Invoice).where(Invoice.id == session_in.invoice_id))
    invoice = result.scalars().first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    settings = await payment_service.get_settings(db, invoice.user_id)
    if not settings:
        raise HTTPException(status_code=400, detail="Payment settings not configured for this user")

    if session_in.provider == "stripe":
        stripe_svc = StripeService(settings)
        session = stripe_svc.create_checkout_session(invoice, session_in.success_url, session_in.cancel_url)
        return {"checkout_url": session.url}
    
    elif session_in.provider == "paypal":
        paypal_svc = PayPalService(settings)
        order = await paypal_svc.create_order(invoice, session_in.success_url, session_in.cancel_url)
        approve_link = next((link["href"] for link in order["links"] if link["rel"] == "approve"), None)
        return {"checkout_url": approve_link}
    
    raise HTTPException(status_code=400, detail="Invalid provider")

@router.post("/stripe/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event_data = json.loads(payload)
        invoice_id = event_data["data"]["object"].get("metadata", {}).get("invoice_id")
        if not invoice_id:
            return {"status": "no_invoice_id"}
        
        result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
        invoice = result.scalars().first()
        if not invoice:
             return {"status": "invoice_not_found"}

        settings = await payment_service.get_settings(db, invoice.user_id)
        
        stripe_svc = StripeService(settings)
        verified_event = stripe_svc.verify_webhook(payload, sig_header)
        
        if verified_event and verified_event["type"] == "checkout.session.completed":
            session = verified_event["data"]["object"]
            await payment_service.handle_payment_success(
                db, 
                invoice.id, 
                PaymentProvider.STRIPE, 
                session["id"], 
                session["amount_total"] / 100
            )
            
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/paypal/webhook")
async def paypal_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.json()
    
    if payload.get("event_type") == "PAYMENT.CAPTURE.COMPLETED":
        resource = payload["resource"]
        invoice_id = resource.get("custom_id")
        if invoice_id:
            await payment_service.handle_payment_success(
                db,
                invoice_id,
                PaymentProvider.PAYPAL,
                resource["id"],
                float(resource["amount"]["value"])
            )
            
    return {"status": "success"}
