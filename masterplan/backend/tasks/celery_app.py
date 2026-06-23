from celery import Celery
import os
import sys

# Ensure backend directory is in the path
sys.path.insert(0, os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

celery_app = Celery(
    "masterplan",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0",
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
