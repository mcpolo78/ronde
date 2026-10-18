# Migration de l'API : Render → Google Cloud Run

> Faite le 18/10/2026 : projet `ronde-api-mc78`, API sur https://ronde-api-r2iybijiha-ey.a.run.app.

Pourquoi : l'offre gratuite de Render endort l'API après 15 min et met ~2 min à la réveiller (502 entre-temps).
Cloud Run démarre un conteneur en 1 à 3 s, toujours à 0 instance au repos, dans l'offre gratuite.

## Ce qui change

| | Avant | Après |
|---|---|---|
| API | Render free, Francfort | Cloud Run, `europe-west3` (Francfort, à côté de Neon) |
| Build | Render (`render.yaml`) | GitHub Actions → image Docker → Artifact Registry ([`deploy-api.yml`](../.github/workflows/deploy-api.yml)) |
| Migrations | commande de build Render | étape du workflow, avant le déploiement |
| Secrets | variables Render | Secret Manager (`DATABASE_URL`, `BETTER_AUTH_SECRET`) |
| Garder éveillé | tâche cron-job.org | inutile (à supprimer après la bascule) |
| Base, back-office, app | Neon, Vercel, EAS | inchangés (seule l'URL de l'API change) |

Fichiers : [`apps/api/Dockerfile`](../apps/api/Dockerfile), [`.dockerignore`](../.dockerignore),
[`infra/gcp/setup.sh`](../infra/gcp/setup.sh), [`infra/gcp/budget-kill-switch/`](../infra/gcp/budget-kill-switch/).

## Coût : rester à 0 €, plafonné à 0,10 €

Réglages du service : 0 à **1 instance max**, 1 vCPU, 512 Mio, CPU facturé uniquement pendant les requêtes.
Ordres de grandeur de l'offre gratuite Cloud Run (par mois, par compte de facturation) : 180 000 vCPU-secondes,
360 000 Gio-secondes, 2 millions de requêtes. Une démo de portfolio en consomme une petite fraction.
Autres postes : Artifact Registry (0,5 Go gratuits ; l'image fait ~150 Mo et le workflow ne garde que 2 versions),
Secret Manager (2 secrets, dans la gratuité), Pub/Sub et la fonction du coupe-circuit (quelques appels par mois).
**À vérifier sur la page de tarifs au moment de créer le compte** : les quotas gratuits peuvent varier selon la région.

⚠ **Un budget GCP ne bloque rien** : il envoie des e-mails. Le plafond réel vient du **coupe-circuit** : le budget
publie sur Pub/Sub, une fonction lit le coût et, au-delà de 0,10 €, **détache la facturation du projet** (tout s'arrête).
Les données de coût arrivent avec quelques heures de retard : le dépassement maximal reste de l'ordre de quelques centimes.
La devise du budget doit être celle du compte de facturation (EUR).

## Étapes

### 1. Compte (toi, dans la console)
1. <https://console.cloud.google.com> → créer le compte de facturation avec ta carte (devise EUR).
2. Installer gcloud : <https://cloud.google.com/sdk/docs/install>, puis :

```bash
gcloud auth login
```

```bash
gcloud billing accounts list
```

### 2. Mise en place (une commande)
Depuis la racine du dépôt, dans Git Bash. Le script demande la chaîne Neon et le secret d'authentification
(reprendre celui de Render garde les sessions ouvertes) :

```bash
PROJECT_ID=ronde-api-<suffixe> BILLING_ACCOUNT=<id> BACKOFFICE_URL=https://ronde-app.vercel.app GITHUB_REPO=mcpolo78/ronde bash infra/gcp/setup.sh
```

À la fin, il affiche les 4 variables à créer sur GitHub (`gh variable set …`) et l'URL Cloud Run.
Ajouter aussi le secret `DATABASE_URL` sur GitHub (même valeur que `DEMO_DATABASE_URL`).

### 3. Premier déploiement
Fusionner la branche `gcp-cloud-run` dans `main` (ou lancer le workflow à la main : Actions → « Déploiement API »).
Le workflow construit l'image, applique les migrations, déploie et vérifie `/health`.

### 4. Bascule (l'API Render tourne encore pendant ce temps)
Remplacer `https://ronde-api-nc26.onrender.com` par l'URL Cloud Run à ces 4 endroits :
1. Vercel → projet du back-office → variable `API_URL`, puis redéployer.
2. [`apps/mobile/eas.json`](../apps/mobile/eas.json) → `EXPO_PUBLIC_API_URL` (nouveau build EAS pour l'APK de démo).
3. Variable GitHub `DEMO_API_URL`.
4. [`docs/deploiement.md`](deploiement.md) (tableau et sections Render).

Vérifier : connexion sur le back-office, une intervention depuis l'app, le réveil depuis le portfolio.

### 5. Ménage
- Supprimer la tâche cron-job.org (plus utile).
- Supprimer le service sur Render, puis [`render.yaml`](../render.yaml).
- Optionnel : l'écran d'attente du réveil peut rester, il ne s'affichera presque plus.

## Retour arrière
L'API Render reste en place jusqu'à l'étape 5 : remettre l'ancienne `API_URL` sur Vercel suffit.

## Relancer après une coupure du coupe-circuit
Vérifier la cause dans la console (Facturation → Rapports), corriger, puis :

```bash
gcloud billing projects link <PROJECT_ID> --billing-account <BILLING_ACCOUNT>
```
