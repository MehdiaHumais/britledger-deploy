"""
BritLedger AI — AI Service
Handles all OpenAI integrations:
- Expense categorization from receipts/screenshots
- Financial insights generation
- Anomaly detection
- VAT reminders and summaries

Uses GPT-4o with structured JSON output for reliable parsing.
All AI responses are strictly informational — no tax manipulation.
"""

from __future__ import annotations

import base64
import json
from typing import Optional
from openai import AsyncOpenAI
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# ── Expense categories (HMRC-aligned) ──────────────────────────────────────
EXPENSE_CATEGORIES = [
    "Office Supplies", "Travel & Transport", "Meals & Entertainment",
    "Software & Subscriptions", "Marketing & Advertising", "Professional Services",
    "Utilities", "Rent & Premises", "Salaries & Wages", "Equipment & Hardware",
    "Training & Education", "Insurance", "Bank Charges", "Other",
]

# ── System prompt (compliance-safe) ────────────────────────────────────────
CATEGORIZE_SYSTEM_PROMPT = """
You are a UK accountancy assistant for BritLedger AI.
Your job is to analyze expense documents and extract structured data.

STRICT RULES:
- Never suggest hiding income or manipulating taxes
- Always advise user to confirm with their accountant for deductibility
- VAT reclaim suggestions are estimates only, not tax advice
- Be conservative — when unsure, suggest "Other" category

Respond ONLY with valid JSON matching this exact schema:
{
  "vendor": "string or null",
  "amount": "number or null",
  "currency": "GBP",
  "date": "YYYY-MM-DD or null",
  "category": "one of the valid categories",
  "description": "brief summary under 100 chars",
  "vat_reclaimable": true/false,
  "vat_estimate": "number or null",
  "deductible": true/false,
  "confidence": "high/medium/low",
  "notes": "short plain-english explanation"
}
"""

INSIGHTS_SYSTEM_PROMPT = """
You are a senior financial analyst at BritLedger AI.
Analyze financial data and provide clear, actionable insights.

STRICT RULES:
- Only report what the data actually shows
- Never fabricate numbers or trends
- Flag anomalies conservatively
- Provide legally-compliant UK tax observations only

Respond ONLY with valid JSON:
{
  "summary": "2-3 sentence overview",
  "insights": [
    {"type": "trend|anomaly|reminder|opportunity", "title": "...", "detail": "...", "priority": "high|medium|low"}
  ],
  "vat_reminder": "string or null",
  "next_actions": ["list of specific action items"]
}
"""


class AIService:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.AI_MODEL

    # ── Expense Categorization ─────────────────────────────────────────────
    async def categorize_expense(
        self,
        text: Optional[str] = None,
        image_base64: Optional[str] = None,
        mime_type: str = "image/jpeg",
    ) -> dict:
        """
        Analyze an expense receipt or note and return structured categorization.
        Accepts either raw text or a base64-encoded image.
        User MUST confirm before any data is saved.
        """
        messages = [{"role": "system", "content": CATEGORIZE_SYSTEM_PROMPT}]

        if image_base64:
            # Vision mode — analyze image (receipt/screenshot)
            messages.append({
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"Please analyze this expense document. Valid categories: {', '.join(EXPENSE_CATEGORIES)}"
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{image_base64}",
                            "detail": "high"
                        }
                    }
                ]
            })
        else:
            # Text mode — analyze description/note
            messages.append({
                "role": "user",
                "content": f"Expense description: {text}\nValid categories: {', '.join(EXPENSE_CATEGORIES)}"
            })

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.1,
                max_tokens=500,
            )
            raw = response.choices[0].message.content
            result = json.loads(raw)

            # Validate category
            if result.get("category") not in EXPENSE_CATEGORIES:
                result["category"] = "Other"

            logger.info("ai_expense_categorized", category=result.get("category"), confidence=result.get("confidence"))
            return {"success": True, "data": result}

        except json.JSONDecodeError as e:
            logger.error("ai_json_parse_error", error=str(e))
            return {"success": False, "error": "AI returned invalid JSON. Please try again."}
        except Exception as e:
            logger.error("ai_expense_error", error=str(e))
            return {"success": False, "error": f"AI service error: {str(e)}"}

    # ── Financial Insights ─────────────────────────────────────────────────
    async def generate_financial_insights(self, financial_data: dict) -> dict:
        """
        Generate actionable financial insights from aggregated business data.
        Input: revenue, expenses, invoice counts, VAT data, date range.
        """
        if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY == "your-openai-api-key":
            return {"success": False, "error": "OpenAI API key is not configured in the backend .env file."}

        data_summary = json.dumps(financial_data, indent=2, default=str)

        try:
            # Check if model supports JSON mode (gpt-4o, gpt-4o-mini, gpt-4-turbo)
            use_json_mode = any(m in self.model for m in ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo-0125"])
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": f"{INSIGHTS_SYSTEM_PROMPT}\nAlways respond in valid JSON format."},
                    {"role": "user", "content": f"Analyze this financial data:\n{data_summary}"}
                ],
                response_format={"type": "json_object"} if use_json_mode else None,
                temperature=0.2,
                max_tokens=800,
            )
            raw = response.choices[0].message.content
            print(f"🤖 Raw AI Response: {raw}") # Log to terminal to see what's happening

            # Robust JSON extraction for older models
            try:
                result = json.loads(raw)
            except json.JSONDecodeError:
                import re
                json_match = re.search(r'\{.*\}', raw, re.DOTALL)
                if json_match:
                    result = json.loads(json_match.group())
                else:
                    raise

            logger.info("ai_insights_generated")
            return {"success": True, "data": result}

        except Exception as e:
            print(f"❌ OpenAI API Error: {str(e)}")  # Print to terminal for visibility
            logger.error("ai_insights_error", error=str(e))
            return {"success": False, "error": f"OpenAI Error: {str(e)}"}

    # ── Expense Anomaly Detection ──────────────────────────────────────────
    async def detect_anomalies(self, expenses: list[dict]) -> dict:
        """Scan expense list for unusual patterns or amounts."""
        if not expenses:
            return {"success": True, "data": {"anomalies": [], "summary": "No expenses to analyze."}}

        expense_summary = json.dumps(expenses[:50], default=str)  # Cap at 50

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a fraud detection specialist for a UK accountancy firm. Identify unusual expense patterns. Respond with JSON: {\"anomalies\": [{\"description\": \"\", \"severity\": \"high|medium|low\", \"expense_index\": 0}], \"summary\": \"\"}"},
                    {"role": "user", "content": f"Analyze these expenses for anomalies:\n{expense_summary}"}
                ],
                temperature=0.1,
                max_tokens=400,
            )
            result = json.loads(response.choices[0].message.content)
            return {"success": True, "data": result}
        except Exception as e:
            logger.error("ai_anomaly_error", error=str(e))
            return {"success": False, "error": str(e)}


# ── Singleton ──────────────────────────────────────────────────────────────
ai_service = AIService()
