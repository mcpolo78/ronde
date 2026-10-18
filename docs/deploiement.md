# Déploiement de la démo

| Composant | Hébergeur | Région | Configuration |
|---|---|---|---|
| Base PostgreSQL | Neon (gratuit) | Francfort | — |
| API (`apps/api`) | Google Cloud Run (gratuit, plafonné à 0,10 €) | Francfort (`europe-west3`) | [`deploiement-gcp.md`](deploiement-gcp.md) |
| Back-office (`apps/web`) | Vercel (Hobby) | Francfort (`fra1`) | [`apps/web/vercel.json`](../apps/web/vercel.json) |

Les trois services sont dans la même région : chaque page fait 1 à 3 appels serveur → API → base, la latence entre eux compte plus que la distance au visiteur.

## 1. Base de données — Neon

1. Créer un compte sur <https://neon.tech> (connexion avec GitHub), puis un projet `ronde`, région **AWS Europe Central 1 (Frankfurt)**.
2. Copier la chaîne de connexion (*Connection string*, format `postgresql://…neon.tech/neondb?sslmode=require`).

## 2. Back-office — Vercel

1. <https://vercel.com/new> → importer `mcpolo78/ronde`.
2. **Root Directory** : `apps/web` (le reste est lu dans `vercel.json`).
3. Variable d'environnement : `API_URL` = `https://ronde-api-r2iybijiha-ey.a.run.app` (URL Cloud Run de l'étape 3).
4. Déployer et noter l'URL de production, ici `https://ronde-app.vercel.app`.

## 3. API — Google Cloud Run

Mise en place et coupe-circuit budgétaire : [`deploiement-gcp.md`](deploiement-gcp.md).
Chaque push sur `main` qui touche l'API déclenche [`deploy-api.yml`](../.github/workflows/deploy-api.yml) :
image Docker, **migrations** (`prisma migrate deploy`), déploiement, puis vérification de `https://ronde-api-r2iybijiha-ey.a.run.app/health`.

## 4. Données de démo — GitHub Actions

Le workflow [`demo.yml`](../.github/workflows/demo.yml) régénère chaque nuit les données de démo (elles sont relatives à « aujourd'hui »).

Il ne s'active qu'une fois configuré :

```bash
gh secret set DEMO_DATABASE_URL          # coller la chaîne Neon quand elle est demandée
gh variable set DEMO_API_URL --body "https://ronde-api-r2iybijiha-ey.a.run.app"
gh workflow run demo.yml                 # premier remplissage de la base
```

Le seed efface toutes les données : il refuse de s'exécuter sur une base distante sans `RONDE_DEMO_SEED=true`, que seul ce workflow définit.

## 5. Démarrage à froid

Cloud Run descend à 0 instance au repos et en relance une en quelques secondes à la première requête :
plus besoin de tâche pour garder l'API éveillée. L'écran d'attente de la page de connexion reste en place,
il ne s'affiche presque plus.
