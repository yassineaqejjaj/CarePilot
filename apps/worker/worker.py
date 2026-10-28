"""Worker Celery : relances automatiques (brouillons à valider) et purge de conservation (loi 09-08)."""
import os

from celery import Celery
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import compliance
from app import models as m
from app import services as svc
from app.core import get_settings, init_engine

app = Celery("carepilot", broker=os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672//"))
app.conf.timezone = "Africa/Casablanca"
app.conf.beat_schedule = {
    "generate-reminders": {"task": "worker.generate_reminders", "schedule": 3600.0},
    "purge-expired": {"task": "worker.purge_expired", "schedule": 86400.0},
}


@app.task(name="worker.generate_reminders")
def generate_reminders() -> int:
    """Prépare des relances (modèles approuvés). Rien n'est envoyé : la coordinatrice valide chaque relance."""
    with Session(init_engine(get_settings().database_url)) as db:
        n = sum(svc.generate_reminder_proposals(db, e.id) for e in db.scalars(select(m.Establishment)))
        db.commit()
        return n


@app.task(name="worker.purge_expired")
def purge_expired() -> int:
    """Anonymise les dossiers clos depuis plus de `retention_days`."""
    with Session(init_engine(get_settings().database_url)) as db:
        n = compliance.purge_expired(db)
        db.commit()
        return n
