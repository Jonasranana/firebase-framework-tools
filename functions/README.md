# Cloud Functions — envois automatiques et synchro Monday

Fonctions déclenchées à la création d'un document Firestore :

- `sendGonflageSignatureEmail` : sur `gonflage_signatures/{token}` (pré-devis
  ou contrat d'entretien envoyé depuis le CRM Station de gonflage), envoie
  un e-mail au client avec le lien de signature, via l'API Gmail.
- `sendLeadWelcomeEmail` : sur `ip5_leads/{leadId}`, envoie un e-mail de
  bienvenue aux leads intéressés par une pompe à chaleur.
- `notifyNewLead` : sur `ip5_leads/{leadId}`, notifie immédiatement
  `contact@ip5energie.com` de l'arrivée d'un nouveau lead (tous projets).
- `syncLeadToMonday` : sur `ip5_leads/{leadId}`, crée immédiatement l'item
  correspondant sur le tableau Monday "Pac Pac😀", au lieu d'attendre le
  cron `scripts/sync-leads-to-monday.mjs` (qui continue de tourner toutes
  les 15 min comme filet de sécurité en cas d'échec de cette fonction).

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
firebase functions:secrets:set MONDAY_API_TOKEN --project kachoto-7554c
```

Pour `GMAIL_SENDER_EMAIL`, coller l'adresse Gmail utilisée à l'étape 3
(celle qui apparaîtra comme expéditeur). Pour `MONDAY_API_TOKEN`, coller le
même jeton API Monday déjà utilisé comme secret GitHub Actions
`MONDAY_API_TOKEN` (profil Monday → Développeurs → Mon jeton d'accès) — un
jeton Secret Manager et un secret GitHub sont deux choses séparées même
s'ils portent le même nom, il faut donc l'enregistrer ici aussi pour que
`syncLeadToMonday` puisse le lire. Sans ce secret, le déploiement de cette
fonction précise échoue (`continue-on-error` protège le reste du
déploiement, voir plus bas), et les leads continuent d'être synchronisés
uniquement par le cron 15 min en attendant.

## 5. Droits IAM pour le déploiement automatique (CI)

Le compte de service déjà utilisé pour déployer le Hosting (secret GitHub
`FIREBASE_SERVICE_ACCOUNT`, ex. `firebase-adminsdk-fbsvc@<projet>...`) a
besoin de rôles supplémentaires pour pouvoir déployer des Cloud Functions
v2 avec déclencheur Eventarc et secrets. Confirmé par un déploiement réel
(plusieurs allers-retours pour identifier exactement ce qu'il fallait).
Dans [IAM & Admin](https://console.cloud.google.com/iam-admin/iam?project=kachoto-7554c),
lui ajouter :

- **Cloud Functions Admin** (`roles/cloudfunctions.admin`)
- **Cloud Build Editor** (`roles/cloudbuild.builds.editor`)
- **Artifact Registry Writer** (`roles/artifactregistry.writer`)
- **Service Account User** (`roles/iam.serviceAccountUser`)
- **Eventarc Admin** (`roles/eventarc.admin`)
- **Service Usage Admin** (`roles/serviceusage.serviceUsageAdmin`) —
  nécessaire dès la toute première vérification des API activées
- **Secret Manager Admin** (`roles/secretmanager.admin`) — englobe la
  lecture des métadonnées des secrets (`secrets.get`, nécessaire au
  déploiement) et la possibilité d'accorder au compte d'exécution de la
  fonction l'accès aux secrets (`setIamPolicy`), que firebase-tools fait
  automatiquement à chaque déploiement
- **Project IAM Admin** (`roles/resourcemanager.projectIamAdmin`) —
  laisse firebase-tools accorder lui-même, au premier déploiement, les
  droits nécessaires aux comptes techniques internes de Google
  (Pub/Sub, Cloud Run, Eventarc) pour que le déclencheur Firestore
  fonctionne, sans quoi il faut les accorder à la main un par un

Sans ces rôles, l'étape "Deploy Cloud Functions" du workflow GitHub Actions
échoue (le Hosting continue de se déployer normalement, c'est une étape
séparée grâce à `continue-on-error`).

Une fois cette configuration faite, chaque envoi de pré-devis ou de contrat
depuis le CRM déclenche automatiquement l'e-mail — rien d'autre à changer.
Au tout premier déploiement d'une fonction 2ᵉ génération sur un projet,
compter quelques minutes de délai de propagation côté Google (le compte
technique Eventarc vient d'être créé) : un simple nouvel essai suffit si
le déploiement échoue une fois avec un message mentionnant l'Eventarc
Service Agent.
