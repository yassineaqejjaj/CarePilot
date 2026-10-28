#!/usr/bin/env python3
"""Activate the bundled login theme without restarting or resetting identity data.
Password is read from KEYCLOAK_ADMIN_PASSWORD. Backups contain realm presentation fields only.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import httpx

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--url',required=True)
p.add_argument('--realm',default='carepilot')
p.add_argument('--backup',type=Path,required=True)
a=p.parse_args()
fields=('loginTheme','internationalizationEnabled','supportedLocales','defaultLocale')
with httpx.Client(base_url=a.url.rstrip('/'),timeout=30) as c:
    r=c.post('/realms/master/protocol/openid-connect/token',data={'client_id':'admin-cli','grant_type':'password','username':os.environ.get('KEYCLOAK_ADMIN','admin'),'password':os.environ['KEYCLOAK_ADMIN_PASSWORD']});r.raise_for_status()
    c.headers['Authorization']='Bearer '+r.json()['access_token']
    base='/admin/realms/'+a.realm
    def get(path):
        r=c.get(base+path);r.raise_for_status();return r.json()
    def identities():
        ids=[]
        for first in range(0,1000000,1000):
            users=get('/users?first='+str(first)+'&max=1000')
            ids.extend((u['id'],u.get('username','')) for u in users)
            if len(users)<1000:break
        clients=sorted((x['id'],x['clientId']) for x in get('/clients'))
        return hashlib.sha256(json.dumps([sorted(ids),clients]).encode()).hexdigest(),len(ids)
    before,count=identities();realm=get('')
    if not a.backup.exists():
        a.backup.parent.mkdir(parents=True,exist_ok=True)
        a.backup.write_text(json.dumps({k:realm.get(k) for k in fields},ensure_ascii=False,indent=2))
    r=c.put(base,json={'loginTheme':'m3aya','internationalizationEnabled':True,'supportedLocales':['fr','ar'],'defaultLocale':'fr'});r.raise_for_status()
    after,_=identities()
    if after!=before:raise RuntimeError('Identity inventory changed during activation; inspect before continuing')
    print(f'M3aya theme enabled; {count} user IDs and all client IDs preserved. No password changes.')
