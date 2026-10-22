"""Worker Celery : relances des tâches échues (squelette). Aucun envoi réel dans le MVP."""
import os

from celery import Celery
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models as m
from app.core import get_settings, init_engine

app = Celery("carepilot", broker=os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672//"))
app.conf.beat_schedule = {"scan-overdue": {"task": "worker.scan_overdue", "schedule": 3600.0}}


@app.task(name="worker.scan_overdue")
def scan_overdue() -> int:
    import datetime as dt
    with Session(init_engine(get_settings().database_url)) as db:
        n = 0
        for t in db.scalars(select(m.Task).where(m.Task.status == "todo", m.Task.due_date < dt.date.today())):
            t.reminders += 1  # compteur de relances ; l'envoi effectif reste soumis à validation
            n += 1
        db.commit()
        return n
