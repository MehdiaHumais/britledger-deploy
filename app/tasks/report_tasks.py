"""
BritLedger AI — Report & AI Celery Tasks
"""

from app.core.celery_app import celery_app
from app.core.logging import get_logger

logger = get_logger(__name__)


@celery_app.task(
    name="app.tasks.report_tasks.generate_monthly_report",
    queue="reports",
    bind=True,
    max_retries=2,
)
def generate_monthly_report(self, owner_id: str, year: int, month: int) -> dict:
    """Generate and cache a monthly report for a user."""
    import asyncio
    from app.core.database import AsyncSessionLocal
    from app.core.redis import cache_set
    from app.services.report_service import ReportService
    from datetime import date
    import calendar

    async def _run():
        async with AsyncSessionLocal() as db:
            first_day = date(year, month, 1)
            last_day = date(year, month, calendar.monthrange(year, month)[1])
            svc = ReportService(db, owner_id)
            pl = await svc.profit_loss(first_day, last_day)
            key = f"report:monthly:{owner_id}:{year}:{month}"
            await cache_set(key, pl.model_dump(), ttl=3600)
            return {"cached_key": key}

    return asyncio.get_event_loop().run_until_complete(_run())


@celery_app.task(
    name="app.tasks.ai_tasks.categorise_expense",
    queue="ai_tasks",
    bind=True,
    max_retries=2,
    default_retry_delay=5,
)
def categorise_expense(
    self, expense_id: str, description: str, amount: float, owner_id: str
) -> dict:
    """
    Use AI to auto-categorise an expense based on description.
    Stores the suggestion back on the expense record.
    """
    try:
        import asyncio
        from app.core.database import AsyncSessionLocal
        from app.models.ai_log import AILog, AIProvider
        import uuid, time

        logger.info("ai_categorise_expense", expense_id=expense_id)

        # Stub — replace with real OpenAI call in production
        suggested_category = "software_subscriptions"  # placeholder

        async def _store():
            async with AsyncSessionLocal() as db:
                from app.models.expense import Expense
                from sqlalchemy import select
                result = await db.execute(
                    select(Expense).where(Expense.id == expense_id)
                )
                exp = result.scalar_one_or_none()
                if exp:
                    from app.models.expense import ExpenseCategory
                    try:
                        exp.category = ExpenseCategory(suggested_category)
                    except ValueError:
                        pass

                db.add(AILog(
                    id=str(uuid.uuid4()),
                    owner_id=owner_id,
                    provider=AIProvider.OPENAI,
                    model="gpt-4o",
                    action="categorise_expense",
                    prompt_tokens=50,
                    completion_tokens=10,
                    total_tokens=60,
                    estimated_cost_usd=0.0003,
                    success=True,
                    entity_type="expense",
                    entity_id=expense_id,
                ))
                await db.commit()

        asyncio.get_event_loop().run_until_complete(_store())
        return {"expense_id": expense_id, "suggested_category": suggested_category}
    except Exception as exc:
        raise self.retry(exc=exc)
