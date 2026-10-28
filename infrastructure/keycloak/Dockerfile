# Keycloak en mode PRODUCTION (build optimisé, proxy TLS devant). Le realm est généré au déploiement avec des mots de passe
# aléatoires (scripts/make-deploy-realm.py). Base : H2 embarquée (démonstration) ; pour une exploitation réelle, utiliser PostgreSQL
# (KC_DB=postgres + KC_DB_URL, après `kc.sh build --db=postgres`) et des sauvegardes.
FROM quay.io/keycloak/keycloak:25.0 AS build
ENV KC_HEALTH_ENABLED=true KC_METRICS_ENABLED=true
RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:25.0
COPY --from=build /opt/keycloak/ /opt/keycloak/
COPY carepilot-realm.json /opt/keycloak/data/import/carepilot-realm.json
ENV KC_HTTP_ENABLED=true KC_PROXY_HEADERS=xforwarded KC_HOSTNAME_STRICT=false
# KC_HOSTNAME (URL publique complète, ex. https://auth.example.com) et KC_HTTP_PORT sont fournis à l'exécution
ENTRYPOINT ["/opt/keycloak/bin/kc.sh", "start", "--optimized", "--import-realm"]
