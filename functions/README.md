# Cloud Functions — envoi automatique des e-mails de signature

Une seule fonction ici : `sendGonflageSignatureEmail`. Elle se déclenche à la
création d'un document `gonflage_signatures/{token}` (pré-devis ou contrat
d'entretien envoyé depuis le CRM Station de gonflage) et envoie un e-mail au
client avec le lien de signature, via l'API Gmail (compte Gmail d'IP5
Énergie, pas un service tiers).

Rien à faire côté code pour l'activer — seulement de la configuration,
à faire une fois, en dehors de ce dépôt :

## 1. Passer le projet sur le plan Blaze

Les Cloud Functions nécessitent la facturation à l'usage (plan Blaze).
Console Firebase → Paramètres du projet → Utilisation et facturation.
Le CRM ne génère qu'un e-mail par envoi de dossier : le coût est
négligeable (largement dans le quota gratuit inclus dans Blaze).

## 2. Créer des identifiants OAuth pour l'API Gmail

Dans [Google Cloud Console](https://console.cloud.google.com/), projet
`kachoto-7554c` :

1. Activer l'**API Gmail** (APIs et services → Bibliothèque).
2. Créer un **ID client OAuth 2.0** de type "Application Web"
   (APIs et services → Identifiants → Créer des identifiants), avec
   `https://developers.google.com/oauthplayground` comme URI de
   redirection autorisée. Note le Client ID et le Client Secret.

## 3. Générer un refresh token (via OAuth Playground)

1. Aller sur https://developers.google.com/oauthplayground
2. Cliquer sur l'icône ⚙️ en haut à droite → cocher **"Use your own OAuth
   credentials"** → coller le Client ID / Client Secret de l'étape 2.
3. Dans la liste de scopes à gauche, saisir manuellement :
   `https://www.googleapis.com/auth/gmail.send`, puis "Authorize APIs".
4. Se connecter avec le compte Gmail qui doit envoyer les e-mails
   (ex. l'adresse Gmail pro d'IP5 Énergie).
5. Cliquer "Exchange authorization code for tokens" → copier le
   **Refresh token** affiché.

## 4. Enregistrer les secrets Firebase

Depuis un poste avec `firebase-tools` connecté sur un compte ayant accès
au projet :

```bash
firebase functions:secrets:set GMAIL_CLIENT_ID --project kachoto-7554c
firebase functions:secrets:set GMAIL_CLIENT_SECRET --project kachoto-7554c
firebase functions:secrets:set GMAIL_REFRESH_TOKEN --project kachoto-7554c
firebase functions:secrets:set GMAIL_SENDER_EMAIL --project kachoto-7554c
```

Pour le dernier, coller l'adresse Gmail utilisée à l'étape 3 (celle qui
apparaîtra comme expéditeur).

## 5. Droits IAM pour le déploiement automatique (CI)

Le compte de service déjà utilisé pour déployer le Hosting (secret GitHub
`FIREBASE_SERVICE_ACCOUNT`) a besoin de rôles supplémentaires pour pouvoir
déployer des Cloud Functions v2. Dans
[IAM & Admin](https://console.cloud.google.com/iam-admin/iam?project=kachoto-7554c),
lui ajouter :

- **Cloud Functions Admin** (`roles/cloudfunctions.admin`)
- **Cloud Build Editor** (`roles/cloudbuild.builds.editor`)
- **Artifact Registry Writer** (`roles/artifactregistry.writer`)
- **Service Account User** (`roles/iam.serviceAccountUser`)
- **Eventarc Admin** (`roles/eventarc.admin`) — déclencheurs Firestore
- **Service Usage Admin** (`roles/serviceusage.serviceUsageAdmin`) — sans ce
  rôle, le déploiement échoue dès la première étape avec une erreur du type
  `403 Permission denied to get service [runtimeconfig.googleapis.com]`,
  avant même de vérifier le plan Blaze ou les secrets Gmail
- **Secret Manager Secret Accessor** (`roles/secretmanager.secretAccessor`) —
  sans ce rôle, le déploiement échoue en essayant de lire les secrets
  `GMAIL_*` avec `403 Permission 'secretmanager.secrets.get' denied`

Sans ces rôles, l'étape "Deploy Cloud Functions" du workflow GitHub Actions
échouera (le Hosting continuera à se déployer normalement, c'est une étape
séparée).

Une fois ces 5 étapes faites, chaque envoi de pré-devis ou de contrat
depuis le CRM déclenche automatiquement l'e-mail — rien d'autre à changer.
