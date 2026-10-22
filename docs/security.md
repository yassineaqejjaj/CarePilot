# Sécurité, données de santé et OpenAI

**CarePilot n'est pas présenté comme conforme RGPD ou HDS.** Ce document décrit les mesures
techniques en place et les validations requises avant tout traitement réel.

## Mesures en place
- Données fictives uniquement (patients créés via l'API avec pseudonyme `P-xxxxxxxx`).
- Isolation par établissement : `establishment_id` lu dans le jeton, filtre systématique, 404 inter-établissements (tests `test_tenant_isolation`, `test_rag_only_approved_and_same_establishment`).
- RBAC `admin / coordinator / designer / viewer`, vérifié côté API.
- Appels OpenAI centralisés dans `OpenAIProvider` ; `store=False` ; redaction e-mail/téléphone/NIR avant envoi ; refus si un identifiant direct subsiste ; le prénom du patient n'est jamais envoyé (substitution locale).
- Logs : métadonnées uniquement (établissement, agent, modèle, tokens, coût). Jamais de prompt ni de réponse.
- Kill-switch : `AI_ENABLED` (global) et `establishment.ai_enabled`.
- Budget mensuel de tokens par établissement ; coûts dans `ai_usage` (`GET /api/ai/usage`).
- Aucun embedding de donnée patient ; RAG limité aux documents `approved` de l'établissement.
- Les agents ne modifient aucun statut : ils créent des `ai_proposal` validées/rejetées par un humain, auditées.
- `AUTH_MODE=test` refusé hors `ENV` dev/test.

## Limites connues
- La redaction par regex ne détecte pas les **noms propres** ni les données de santé en texte libre : le texte libre patient envoyé au Follow-up Agent reste un risque tant que le circuit n'est pas validé.
- Pas de chiffrement applicatif des colonnes, pas de politique de rétention automatisée (à implémenter : purge `audit_log`/`ai_proposal`).
- Pas de rate-limiting, pas de scan de dépendances (à ajouter en CI).
- Tarifs OpenAI non codés en dur : le coût affiché est exact seulement si `OPENAI_PRICE_*` est renseigné.
- Jeton de dev du frontend collé à la main ; l'intégration `keycloak-js` reste à faire.

## Avant tout traitement de données réelles (obligatoire)
1. Analyse d'impact (AIPD) et base légale RGPD ; rôle des parties (responsable de traitement / sous-traitant).
2. Contrat de sous-traitance (DPA) avec OpenAI, localisation et garanties des transferts hors UE.
3. Hébergement HDS pour les données de santé : l'hébergeur de la plateforme doit être certifié ; vérifier que les flux vers OpenAI sont compatibles.
4. Revue sécurité/pentest, politique de conservation, procédure de violation de données.

## Coûts OpenAI
Un appel LLM = un `responses.parse` ; un chargement de procédure = un appel embeddings par lot de segments (~800 caractères). Chaque agent « avec RAG » fait en plus 1 embedding de requête. Ordre de grandeur à mesurer via `/api/ai/usage` sur des données fictives avant de fixer le budget.
