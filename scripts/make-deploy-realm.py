#!/usr/bin/env python3
"""Génère un realm Keycloak de déploiement : mots de passe aléatoires et redirect URIs du frontend.

usage: make-deploy-realm.py <dossier-sortie> <url-frontend>
Écrit <dossier>/carepilot-realm.json (+ Dockerfile) et <dossier>/credentials.txt (à NE PAS commiter).
"""
import json
import pathlib
import secrets
import shutil
import sys

out, front = pathlib.Path(sys.argv[1]), sys.argv[2].rstrip("/")
src = pathlib.Path(__file__).resolve().parent.parent / "infrastructure" / "keycloak"
out.mkdir(parents=True, exist_ok=True)
realm = json.loads((src / "carepilot-realm.json").read_text())
creds = {}
for u in realm["users"]:
    pw = secrets.token_urlsafe(12)
    u["credentials"][0]["value"] = pw
    creds[u["username"]] = pw
client = realm["clients"][0]
client["redirectUris"] = [f"{front}/*", "http://localhost:5173/*"]
client["webOrigins"] = [front, "http://localhost:5173"]
(out / "carepilot-realm.json").write_text(json.dumps(realm, indent=2, ensure_ascii=False))
shutil.copy(src / "Dockerfile", out / "Dockerfile")
shutil.copytree(src / "themes", out / "themes", dirs_exist_ok=True)
(out / "credentials.txt").write_text("\n".join(f"{k} / {v}" for k, v in creds.items()) + "\n")
print("realm généré pour", front)
