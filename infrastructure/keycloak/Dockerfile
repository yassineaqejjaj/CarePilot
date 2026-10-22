# Image Keycloak pour la démo en ligne (Railway). Le realm est généré au déploiement (mots de passe aléatoires),
# voir scripts/make-deploy-realm.py. `start-dev` convient à une DÉMO, pas à une production.
FROM quay.io/keycloak/keycloak:25.0
COPY carepilot-realm.json /opt/keycloak/data/import/carepilot-realm.json
ENV KC_HTTP_ENABLED=true KC_PROXY_HEADERS=xforwarded KC_HEALTH_ENABLED=true
ENTRYPOINT ["/opt/keycloak/bin/kc.sh", "start-dev", "--import-realm"]
