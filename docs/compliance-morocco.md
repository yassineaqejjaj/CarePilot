# Conformité au Maroc — loi 09-08 et CNDP

> **Ce document n'est pas un avis juridique.** Il résume ce qui a été **vérifié dans les sources citées** (octobre 2026), ce qui l'a été
> seulement par des sources secondaires, et ce qui reste à confirmer avec un juriste marocain et la CNDP avant tout traitement de
> données réelles. CarePilot fournit des **mécanismes** de conformité ; il n'est ni « certifié » ni « autorisé » par lui-même.

## 1. Cadre applicable

| Texte | Ce qu'il implique pour CarePilot | Niveau de vérification |
|---|---|---|
| **Loi n° 09-08** (Dahir 1-09-15 du 18/02/2009) et décret 2-09-165 | Consentement, information du patient (art. 5), droits d'accès / rectification / opposition, sécurité, sous-traitants, conservation limitée | Visée dans la délibération D-941-2025 (source primaire) |
| **Délibération CNDP D-941-2025 du 28/11/2025** — modèle d'autorisation pour le *suivi des patients* | Traitement de données de santé = **autorisation préalable** de la CNDP (CNDP-FORMS). Finalités autorisées incluant la prise de rendez-vous et le *suivi du parcours des patients dans les établissements de santé*. Données listées : identité, coordonnées, naissance, **CIN / passeport**, **numéro d'organisme de prévoyance sociale**, données de santé. Origine : recueillies auprès du patient. Conservation « strictement nécessaire ». Information : identité du responsable, finalités, données, destinataires (dont transferts à l'étranger autorisés), contact pour les droits, **référence de l'autorisation CNDP**. Sécurité et clauses avec les sous-traitants. **Transfert à l'étranger : autorisation préalable.** | **Lue en intégralité** (PDF officiel cndp.ma) |
| **Loi 131-13** relative à l'exercice de la médecine | Secret professionnel : l'accès aux dossiers doit rester limité au personnel habilité | Visée dans D-941-2025 ; contenu non relu |
| **Loi 05-20** (cybersécurité) et décret 2-21-406 ; référentiel de qualification des prestataires cloud (arrêté 3-17-25 du 01/08/2025, BO 7432) | Obligations pour les entités d'importance vitale ; régime de qualification des prestataires cloud (niveaux 1 et 2). **À vérifier : une clinique privée est-elle concernée ?** | Presse et cabinets (sources secondaires) |
| **Loi 43-20** (services de confiance) | Une signature **qualifiée** (prestataire agréé DGSSI) équivaut à la signature manuscrite. La case « J'accepte » du portail est un consentement **simple**, pas une signature qualifiée | Presse (source secondaire) |
| **CNDP — prospection directe (art. 10 loi 09-08)** | Les messages envoyés sont **administratifs** (rappels de pièces, lien d'accès), jamais promotionnels | Fiche CNDP citée par la recherche, non relue |

**Points non vérifiés** : règles de l'ANRT / des opérateurs sur l'identifiant d'expéditeur des SMS ; liste à jour des pays reconnus « adéquats » par la CNDP ;
régime exact du transfert (autorisation ou notification : une délibération de 2020 parle de notification, D-941-2025 d'autorisation) ; existence d'une obligation
de localisation des données de santé pour une clinique privée (non trouvée) ; texte légal sur l'IA (aucun trouvé).

## 2. Ce que CarePilot met en œuvre

| Exigence | Mise en œuvre | Où |
|---|---|---|
| Information du patient avec référence CNDP (art. 5) | Notice affichée **avant tout accès** (responsable, finalité, données, destinataires, conservation, contact droits, n° d'autorisation), versionnée | `app/compliance.py`, écran de consentement |
| Consentement | Enregistré (version de la notice, date, canal) ; l'API refuse dépôts et réponses tant qu'il manque (`consent_required`) ; refus possible sans pénalité | `routers/portal.py`, tests |
| Information à la collecte par le personnel | Case obligatoire « patient informé » à la création et à l'import | `routers/core_routes.py` |
| Droits d'accès / rectification / opposition / effacement | Export JSON des données depuis le portail ; demandes tracées et traitées dans *Paramètres* ; effacement = anonymisation réservée à l'admin | `portal /my-data /rights`, `ops_routes` |
| Conservation limitée | Durée par établissement (30-3650 j) ; purge quotidienne (worker) ou à la demande ; anonymisation des patients dont tous les parcours sont clos | `compliance.purge_expired` |
| Sécurité et secret | Isolation par établissement, rôles, pièces **chiffrées** (Fernet) au repos, téléchargements tracés, jetons de lien hachés, limitation de débit, en-têtes de sécurité | `storage.py`, `ratelimit.py` |
| Accès patient sans compte | Lien à usage limité (72 h) **+ date de naissance**, verrouillé après 5 erreurs, réponse identique à tout échec | `portal /session` |
| Transfert à l'étranger | L'IA (OpenAI, hors du Maroc) **reste bloquée** tant que la référence d'autorisation CNDP du transfert n'est pas saisie ; aucun identifiant direct n'est envoyé (CIN, téléphones +212, numéros CNSS/CNOPS, e-mails détectés et refusés) | `services.ai_status`, `ai/guardrails` |
| Traçabilité | Journal d'audit exportable (admin) : validations, téléchargements, exports, demandes de droits, changements de paramètres | `audit_log` |
| Pas de décision automatique | L'IA ne fait que **proposer** ; un humain nommé valide chaque envoi ; aucun avis médical (filtre de contenu) | agents, file de validation |

## 3. À faire par la clinique avant la mise en service réelle

1. **Déposer la demande d'autorisation CNDP** (CNDP-FORMS) en s'appuyant sur la délibération D-941-2025 ; saisir la référence dans *Paramètres*.
2. **Transferts à l'étranger** (hébergement hors Maroc, OpenAI, passerelle de messagerie étrangère) : obtenir l'autorisation ou la notification applicable, puis saisir la référence. Sans cela, laisser l'IA désactivée.
3. **Contrats avec chaque sous-traitant** (hébergeur, messagerie, éventuellement OpenAI) : garanties de sécurité et de confidentialité (D-941-2025 §9).
4. **Hébergement** : privilégier un prestataire établi au Maroc, de préférence qualifié selon le référentiel DGSSI ; vérifier avec un juriste si la clinique relève de la loi 05-20.
5. Désigner le **contact pour les droits** (e-mail ou téléphone) et fixer la **durée de conservation** avec le médecin responsable (obligations de conservation du dossier médical à vérifier : CarePilot ne gère que l'administratif).
6. **Messagerie** : choisir un fournisseur WhatsApp Business / SMS ; vérifier avec l'opérateur les règles d'identifiant d'expéditeur ; tenir les messages strictement administratifs.
7. **Secrets de production** : `PATIENT_SESSION_SECRET`, `FILE_ENCRYPTION_KEY` (clé Fernet), mots de passe Keycloak ; sauvegardes chiffrées de la base **et** de la clé de chiffrement des pièces.
8. **Revue de sécurité / test d'intrusion**, formation du personnel, procédure d'incident.
9. Faire **relire les textes en arabe** (notice et portail) par un locuteur natif.

## 4. Sources

- CNDP, [Délibération n° D-941-2025 du 28/11/2025 — modèle de demande d'autorisation type pour les traitements de suivi des patients](https://www.cndp.ma/wp-content/uploads/2025/12/Deliberation-n%c2%b0-D-941-2025-du-28112025-relative-au-modele-de-demande-dautorisation-type-pour-les-traitements-de-suivi-des-patients-20251203.pdf) (source primaire).
- CNDP, [Délibération D-113-2020](https://www.cndp.ma/wp-content/uploads/2023/01/CNDP_Deliberation-n-D-113-2020_22-05-2020.pdf) (transferts : régime de notification).
- Upsilon Consulting, [Déclarations et autorisations CNDP](https://upsilon-consulting.com/declarations-autorisations-cndp-guide-pratique/) et [Transfert international de données](https://upsilon-consulting.com/transfert-international-donnees-personnelles-maroc/) (secondaires).
- Le360, [Cloud souverain](https://fr.le360.ma/economie/cloud-souverain-le-maroc-franchit-un-pas-decisif-sur-le-terrain-juridique_Y37PYS2R5RDCXL7HS65VPE76Y4/) et [référentiel de qualification des prestataires cloud](https://fr.le360.ma/economie/cybersecurite-le-maroc-adopte-un-referentiel-strict-pour-la-qualification-des-prestataires-cloud_MKGUWQ5MTZBBNPAWH6SE5I4HEY/) (presse).
- CNDP, [fiche Prospection directe](https://www.cndp.ma/wp-content/uploads/2025/07/fiche_CNDP_Prospection_RT_fr.pdf).
