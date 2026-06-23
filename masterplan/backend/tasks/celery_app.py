from celery import Celery
import os
import sys

# Ensure backend directory is in the path
sys.path.insert(0, os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "masterplan",
    broker=redis_url,
    backend=redis_url,
    include=["tasks.render_task"]
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)
