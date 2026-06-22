from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import Optional
from app.core.logging import get_logger
from app.services.ai_service import ai_service
from app.schemas.common import APIResponse

logger = get_logger(__name__)
router = APIRouter(prefix="/ai", tags=["AI Features"])

@router.post("/categorize", summary="Categorize an expense using AI")
async def categorize_expense(
    text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    """
    Categorize an expense from text description or an uploaded receipt image.
    """
    if not text and not file:
        raise HTTPException(status_code=400, detail="Must provide text or a receipt image")

    image_base64 = None
    mime_type = "image/jpeg"
    
    if file:
        content = await file.read()
        import base64
        image_base64 = base64.b64encode(content).decode('utf-8')
        mime_type = file.content_type or "image/jpeg"

    result = await ai_service.categorize_expense(text=text, image_base64=image_base64, mime_type=mime_type)
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])

    return APIResponse(message="Expense categorized", data=result["data"])

@router.post("/insights", summary="Generate financial insights")
async def get_insights(financial_data: dict):
    """
    Generate actionable financial insights based on the provided JSON payload.
    """
    result = await ai_service.generate_financial_insights(financial_data)
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])

    return APIResponse(message="Insights generated", data=result["data"])

@router.post("/anomalies", summary="Detect expense anomalies")
async def detect_anomalies(expenses: list[dict]):
    """
    Scan a list of expenses for unusual patterns.
    """
    result = await ai_service.detect_anomalies(expenses)
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])

    return APIResponse(message="Anomalies detected", data=result["data"])
