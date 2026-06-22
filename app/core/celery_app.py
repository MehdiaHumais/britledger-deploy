from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "britledger",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

# Vercel Serverless Mode: Tasks run synchronously in the request
# Since Vercel cannot run a separate Celery Worker process, we force 
# tasks to execute immediately (Eager Mode).
if settings.APP_ENV == "production":
    celery_app.conf.update(
        task_always_eager=True,
        task_eager_evaluates=True,
    )
else:
    celery_app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
        task_track_started=True,
        task_time_limit=3600,
    )

# Auto-discover tasks from app.tasks
celery_app.autodiscover_tasks(["app.tasks"])
