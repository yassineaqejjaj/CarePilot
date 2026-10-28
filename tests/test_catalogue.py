import datetime as dt
import io
import uuid
from sqlalchemy import select
from app import catalogue as c, models as m, services as svc
from app.core import get_settings, today
from tests.test_morocco import make_journey


def test_nine_distinct_administrative_references():
    assert len(c.CATALOGUE)==len(c.BY_KEY)==9
    for b in c.CATALOGUE:
        assert len(b['steps'])>=9 and b['owner'] and b['outcome'] and b['anchor_label']
        assert any(s['kind']=='document' for s in b['steps'])
        assert any(s['kind']=='task' for s in b['steps'])
        assert any(s['offset_days']==0 for s in b['steps'])
        assert all(s['kind'] in ('task','document','message','questionnaire') for s in b['steps'])
    urgent=c.BY_KEY['admission_non_programmee']
    assert all(not s['blocking'] and s['offset_days']>=0 for s in urgent['steps'])
    assert c.BY_KEY['maternite']['steps']!=c.BY_KEY['consultation']['steps']


def test_catalogue_read_does_not_install_or_leak_tenants(client,auth,make_est,db_factory):
    a,b=make_est(),make_est('Other')
    with db_factory() as db:
        c.install_demo(db,a);db.commit()
    own=client.get('/api/catalogue',headers=auth(a)).json()
    assert len(own['items'])==9 and all(i['status']=='published' for i in own['items'])
    other=client.get('/api/catalogue',headers=auth(b)).json()
    assert all(i['status']=='not_installed' and i['template_id'] is None for i in other['items'])
    assert client.get('/api/templates',headers=auth(b)).json()==[]
    assert client.get('/api/catalogue').status_code==401


def test_install_requires_designer_and_defaults_to_draft(client,auth,make_est,monkeypatch):
    monkeypatch.setattr(get_settings(),'demo_mode',False)
    est=make_est();h=auth(est)
    assert client.post('/api/catalogue/imagerie/install',headers=auth(est,roles=('coordinator',))).status_code==403
    first=client.post('/api/catalogue/imagerie/install',headers=h).json()
    assert first['status']=='draft' and first['created']
    assert client.post('/api/catalogue/imagerie/install',headers=h).json()['created'] is False
    assert client.post('/api/catalogue/missing/install',headers=h).status_code==404
    assert client.post('/api/catalogue/imagerie/example',headers=h).status_code==404
    assert len(client.get('/api/templates',headers=h).json())==1


def test_demo_install_preserves_old_versions_and_patient_journeys(client,auth,make_est,db_factory):
    est=make_est();h=auth(est);jid,tpl=make_journey(client,h)
    version=client.post(f'/api/templates/{tpl}/new-version',headers=h).json()['id']
    before=client.get(f'/api/journeys/{jid}/tasks',headers=h).json()
    with db_factory() as db:
        assert c.install_demo(db,est)==8
        assert c.install_demo(db,est)==0
        db.commit()
    assert client.get(f'/api/journeys/{jid}/tasks',headers=h).json()==before
    templates=client.get('/api/templates',headers=h).json()
    assert next(t for t in templates if t['id']==version)['status']=='draft'
    ambulatory=next(i for i in client.get('/api/catalogue',headers=h).json()['items'] if i['key']=='ambulatoire')
    assert ambulatory['template_id']==tpl  # prefer active published over a newer draft


def test_all_examples_are_real_scoped_idempotent_and_use_chosen_pathway(client,auth,make_est,db_factory,monkeypatch):
    monkeypatch.setattr(get_settings(),'demo_mode',True)
    a,b=make_est(),make_est('Other');h=auth(a)
    ids=[]
    for blueprint in c.CATALOGUE:
        key=blueprint['key']
        r=client.post(f'/api/catalogue/{key}/example',headers=h)
        assert r.status_code==200,r.text
        j=r.json();ids.append(j['id'])
        assert j['created']
        repeated=client.post(f'/api/catalogue/{key}/example',headers=h).json()
        assert repeated['id']==j['id'] and repeated['created'] is False
        detail=client.get(f"/api/journeys/{j['id']}/detail",headers=h).json()
        assert detail['template_name']==blueprint['name'] and detail['catalogue']['key']==key
        assert len(detail['timeline'])==len(blueprint['steps'])
        reference=dt.date.fromisoformat(detail['surgery_date'])
        expected={reference+dt.timedelta(days=s['offset_days']) for s in blueprint['steps']}
        assert {dt.date.fromisoformat(t['due_date']) for t in detail['timeline']}==expected
        assert client.get(f"/api/journeys/{j['id']}/detail",headers=auth(b)).status_code==404
    with db_factory() as db:
        assert len(db.scalars(select(m.Patient).where(m.Patient.establishment_id==a)).all())==9
    assert len(set(ids))==9


def test_create_and_import_respect_selected_pathway(client,auth,make_est,db_factory):
    est=make_est();h=auth(est)
    with db_factory() as db:
        c.install_demo(db,est);db.commit()
    items=client.get('/api/catalogue',headers=h).json()['items']
    imaging=next(i for i in items if i['key']=='imagerie')
    result=client.post('/api/journeys',headers=h,json={'patient':{'first_name':'A','last_name':'B','informed':True},'template_id':imaging['template_id'],'surgery_date':(today()+dt.timedelta(days=4)).isoformat()}).json()
    d=client.get(f"/api/journeys/{result['id']}/detail",headers=h).json()
    assert d['catalogue']['key']=='imagerie' and 'Prescription fournie' in str(d['timeline'])
    csv='first_name;last_name;surgery_date;pathway\nSara;Example;30/12/2030;maternite\nBad;Row;30/12/2030;not-real\n'
    imp=client.post('/api/journeys/import',headers=h,files={'file':('patients.csv',io.BytesIO(csv.encode()),'text/csv')}).json()
    assert imp['created']==1 and imp['errors'][0]['line']==3
    with db_factory() as db:
        pat=db.scalar(select(m.Patient).where(m.Patient.first_name=='Sara'))
        j=db.scalar(select(m.PatientJourney).where(m.PatientJourney.patient_id==pat.id))
        assert db.get(m.JourneyTemplate,j.template_id).name==c.BY_KEY['maternite']['name']
