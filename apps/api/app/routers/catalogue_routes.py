"""Clinic projection catalogue. Blueprint installation and dedicated fictitious examples are additive."""
from __future__ import annotations
import datetime as dt
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app import catalogue as c, models as m, services as svc, intake
from app.core import Principal, get_db, get_settings, require_roles, today

router=APIRouter(prefix="/catalogue")
Staff=Depends(require_roles("admin","coordinator","designer","viewer"))
Design=Depends(require_roles("admin","designer"))
Coord=Depends(require_roles("admin","coordinator"))


def blueprint(key):
    if key not in c.BY_KEY:raise HTTPException(404,"Modèle inconnu")
    return c.BY_KEY[key]


@router.get("")
def list_catalogue(p:Principal=Staff,db:Session=Depends(get_db)):
    return {"items":c.listing(db,p.establishment_id),"demo_mode":get_settings().demo_mode,
            "notice":"Références administratives à adapter à votre établissement. Les pièces et délais ne sont pas des exigences médicales universelles."}


@router.post("/{key}/install")
def install(key:str,p:Principal=Design,db:Session=Depends(get_db)):
    blueprint(key)
    t,created=c.install(db,p.establishment_id,key,published=get_settings().demo_mode)
    if created:svc.audit(db,p,"catalogue.install","journey_template",t.id,key=key,status=t.status)
    db.commit()
    return {"id":str(t.id),"status":t.status,"created":created}


@router.post("/{key}/example")
def example(key:str,p:Principal=Coord,db:Session=Depends(get_db)):
    if not get_settings().demo_mode:raise HTTPException(404,"Exemples fictifs réservés au mode démonstration")
    b=blueprint(key)
    scenario_id=uuid.uuid5(uuid.NAMESPACE_URL,f"m3aya:{p.establishment_id}:example:{key}")
    existing=db.get(m.ActionPlan,scenario_id)
    if existing:
        jid=uuid.UUID(existing.payload["journey_id"])
        j=svc.get_scoped(db,m.PatientJourney,jid,p)
        return {"id":str(j.id),"reference":j.reference,"created":False}
    tpl,_=c.install(db,p.establishment_id,key,published=True)
    if tpl.status!="published":raise HTTPException(409,"Publiez le modèle avant de créer son exemple")
    pat=intake.make_patient(db,p.establishment_id,first_name=b["patient"][0],last_name=b["patient"][1]+" · Exemple",birth_date="14/03/1986")
    j=intake.make_journey(db,p,pat,surgery_date=today()+dt.timedelta(days=b["days"]),procedure=b["anchor"]+" · fictif",owner=b["owner"],template=tpl)
    # Illustrate a single missing document; already elapsed background tasks are completed.
    missing=next((t for t in sorted(j.tasks,key=lambda t:t.due_date) if t.kind=="document"),None)
    for t in j.tasks:
        t.owner=b["owner"]
        if t.id!=(missing.id if missing else None) and t.due_date<today():svc.complete_task(t)
    db.add(m.ActionPlan(id=scenario_id,establishment_id=p.establishment_id,actor=p.sub,intent="catalogue-example",payload={"key":key,"journey_id":str(j.id)}))
    svc.audit(db,p,"catalogue.example","patient_journey",j.id,journey_id=str(j.id),key=key,synthetic=True)
    db.commit()
    return {"id":str(j.id),"reference":j.reference,"created":True}
