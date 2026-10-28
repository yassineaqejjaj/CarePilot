# M3aya Santé — catalogue de projection clinique

M3aya (معايا, « avec moi ») est le nom de travail du produit, anciennement CarePilot. Disponibilité de marque à vérifier avant dépôt. Les identifiants techniques et les anciennes URL restent stables.

Le catalogue de référence couvre neuf activités. Il sert à explorer et adapter un fonctionnement administratif, pas à prescrire un protocole médical. Chaque clinique valide ses pièces, ses délais, ses affectations et ses communications.

## Utiliser le catalogue

1. Ouvrir **Catalogue de parcours** et filtrer par activité.
2. Choisir **Explorer le parcours** pour lire les objectifs, étapes, pièces et responsabilités.
3. Lancer **Simuler ce parcours** pour jouer les scénarios sans écrire de dossier.
4. En démonstration, **Voir un dossier exemple** crée ou retrouve un dossier fictif dédié à cette activité.
5. **Adapter dans le concepteur** ouvre la bonne version ; une version publiée est immuable.
6. **Créer un dossier sur ce modèle** pré-sélectionne le bon modèle publié dans la fiche d'entrée.

Hors démonstration, **Installer ce modèle** crée un brouillon à faire approuver et publier. Les exemples ne sont pas disponibles.

## Activités couvertes

- Consultation spécialisée : confirmation, identité, couverture éventuelle, accueil et clôture.
- Imagerie : prescription fournie, identité, prise en charge, réception et facturation. Les consignes de préparation restent du ressort du service.
- Endoscopie : dossier d'admission, couverture, contacts et informations pratiques. Aucune consigne de jeûne ou de médicament n'est générée.
- Chirurgie ambulatoire : reprise du parcours existant J−21 à J+7, sans écraser ses versions.
- Hospitalisation programmée : préadmission, garanties, accueil, suivi des pièces et sortie. Les jalons doivent être ajustés à la durée réelle du séjour.
- Maternité : préadmission, couverture, contacts familiaux et formalités de séjour. La date est prévisionnelle ; aucune donnée de nouveau-né n'est exigée avant sa naissance.
- Hôpital de jour : coordination administrative d'une séance dont la date est fournie par l'équipe médicale. Un parcours n'est pas un protocole thérapeutique.
- Rééducation : dossier de démarrage, prescription fournie, disponibilités et pièces de remboursement. Aucun exercice ni calendrier de soins n'est prescrit.
- Admission non programmée : formalités différées après l'accueil. Aucune pièce n'est marquée comme bloquant l'accès aux soins urgents.

## Import et compatibilité

La colonne CSV facultative `pathway` accepte la clé affichée dans le README : par exemple `imagerie`, `maternite` ou `reeducation`. Le modèle correspondant doit être publié dans le même établissement. Une clé invalide produit une erreur sur la ligne, sans créer un patient incomplet. Sans clé, le modèle ambulatoire publié reste le défaut historique.

Le champ technique `surgery_date` reste utilisé comme date de référence pour compatibilité API. Les libellés visibles et les descriptions précisent le rendez-vous ou l'admission concerné. Les fichiers patients ne sont pas indexés dans le RAG des procédures.
