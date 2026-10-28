# Sécurité

Le cadre réglementaire (Maroc, loi 09-08 / CNDP) est détaillé dans [compliance-morocco.md](compliance-morocco.md). Ce document décrit les mesures techniques.

## Mesures en place
- **Données fictives uniquement** tant que l'autorisation CNDP n'est pas obtenue ; les patients portent un pseudonyme `PT-xxxx-xxxx` (celui que voit l'IA).
- **Isolation par établissement** (claim du jeton, filtre systématique, 404 inter-établissements) et **RBAC** (`admin`, `coordinator`, `designer`, `viewer`, `patient`) ; les patients n'accèdent qu'à `/api/portal/*`.
- **Accès patient** : lien à usage limité (72 h, hash seul stocké) + date de naissance, 5 essais, même réponse à tout échec, session courte signée par un secret distinct de Keycloak.
- **Pièces patient** : type vérifié sur les octets (PDF/JPEG/PNG/HEIC), taille limitée, nom assaini, **chiffrées (Fernet)** avant stockage, téléchargement réservé au personnel et tracé.
- **IA** : appels centralisés dans `OpenAIProvider`, `store=False`, redaction/refus des identifiants (e-mail, CIN, +212, CNSS/CNOPS), prénom substitué localement, journaux sans contenu, budget par établissement, interrupteur global et par établissement, **blocage sans autorisation de transfert CNDP**.
- **Messagerie** : modèles approuvés uniquement, destinataire masqué dans le journal, canal choisi par le patient.
- **HTTP** : limitation de débit par IP (10/min sur l'ouverture de session patient), `nosniff`, `X-Frame-Options: DENY`, `no-store` sur l'API, aucun secret côté navigateur ; le mode d'authentification de test est refusé hors dev/test, et `PATIENT_SESSION_SECRET` / `FILE_ENCRYPTION_KEY` sont exigés hors dev/test.

## Limites connues
- La redaction par expressions régulières **ne détecte pas les noms propres** en texte libre.
- Pas d'antivirus sur les pièces (ClamAV à brancher), pas de rotation automatique de la clé de chiffrement, pas de chiffrement des colonnes de la base, limitation de débit en mémoire (une seule instance).
- Keycloak : l'image de démonstration utilise `start-dev` si l'image de production n'est pas construite ; sauvegardes à mettre en place.
- Aucun test d'intrusion réalisé.

## Coûts OpenAI
Une génération structurée = un appel Responses ; chaque chargement de procédure = un appel d'embeddings par lot ; chaque agent avec RAG ajoute un embedding de requête. À mesurer sur données fictives via `GET /api/ai/usage` avant de fixer un budget. Les tarifs ne sont pas codés en dur (`OPENAI_PRICE_*`).


## v0.3 — assistance et démonstration
- OCR local sur deux pages maximum, délai d'exécution limité, deux lectures simultanées maximum ; résultats chiffrés et validation humaine obligatoire. Aucun fichier ni texte OCR n'est envoyé à un LLM.
- Dictée locale (faster-whisper, modèle multilingue tiny) : 30 secondes / 5 Mo maximum, une transcription à la fois ; fichiers temporaires supprimés après traitement. Le patient doit relire le résultat avant d'envoyer. La précision en darija n'a pas encore fait l'objet d'une évaluation native.
- Copilote : aperçu stocké et périmétré par établissement/auteur, expiration à 15 minutes, confirmation idempotente, contrôle des statuts courants avant création de brouillons. Les actions du copilote ne déclenchent pas d'envoi.
- Assistant patient : seules les cartes de procédures approuvées du même établissement sont citées. Les questions hors périmètre peuvent être transmises au personnel. Les demandes sont chiffrées, visibles au personnel habilité et incluses dans l'export patient. Aucune conversation libre n'est transmise à OpenAI.
- Simulation : aucune écriture. Démonstration guidée : création additive d'un patient fictif dédié, réservée au mode DEMO_MODE, sans remise à zéro des dossiers existants.
- Synchronisation : interrogation authentifiée d'une révision toutes les trois secondes ; aucun jeton dans une URL de flux public.
