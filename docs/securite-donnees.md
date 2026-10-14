# Sécurité et sauvegardes des données du CRM IP5

## Qui peut accéder
- Connexion Google obligatoire. Seuls les 3 administrateurs (Jonas, Alexis, Carole Sitbon) et les personnes ajoutées dans « Équipe et accès » ont accès au CRM (règles Firestore et Storage + fonctions).
- Aucune donnée du CRM n'est lisible sans être connecté avec un compte autorisé. Le site public ne peut que **créer** un lead (`ip5_leads`).

## Rien n'est effacé d'un coup
- Fiches (leads) : « Corbeille » → récupérables 30 jours (page « Corbeille et doublons »), puis effacées par `purge-crm-trash.yml`.
- Documents : même principe (corbeille 30 jours).
- Fusion de doublons : uniquement sur clic confirmé ; les fiches fusionnées vont à la corbeille.
- Station de gonflage : un dossier « supprimé » est seulement mis de côté (`deletedAt`), jamais détruit.
- Les fichiers envoyés ne sont jamais compressés ni modifiés ; leur taille est vérifiée à l'arrivée.

## Sauvegardes (workflow « Sauvegarde et vérification du CRM »)
- Chaque nuit (01 h 30 UTC) : copie de toutes les collections dans Storage `backups/AAAA-MM-JJ/<collection>.jsonl.gz`, relue et vérifiée. 30 jours conservés. L'archive Monday (`monday_*`) est copiée le 1er et le 15.
- Chaque nuit : vérification que chaque document indexé a son fichier, que chaque fichier est indexé, et que les compteurs « Docs » sont justes. Résultat affiché dans la page Documents (bandeau « Données protégées »). En cas de problème le workflow passe au rouge et GitHub envoie un e-mail.
- Firestore : récupération à un moment précis (7 jours) activée dans la console Firebase.

## Restaurer
1. GitHub → Actions → « Restaurer une sauvegarde du CRM » → Run workflow.
2. Indiquer le jour (ex. 2026-10-14), la collection (ex. `crm_leads`), éventuellement un identifiant de document. **Laisser « essai à blanc » coché** pour voir ce qui serait restauré, puis relancer sans la case pour restaurer.
3. La restauration ne supprime jamais rien : elle remet les documents indiqués dans l'état de la sauvegarde.
