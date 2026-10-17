# Déploiement de la démo

| Composant | Hébergeur | Région | Configuration |
|---|---|---|---|
| Base PostgreSQL | Neon (gratuit) | Francfort | — |
| API (`apps/api`) | Render (gratuit) | Francfort | [`render.yaml`](../render.yaml) |
| Back-office (`apps/web`) | Vercel (Hobby) | Francfort (`fra1`) | [`apps/web/vercel.json`](../apps/web/vercel.json) |

Les trois services sont dans la même région : chaque page fait 1 à 3 appels serveur → API → base, la latence entre eux compte plus que la distance au visiteur.

## 1. Base de données — Neon

1. Créer un compte sur <https://neon.tech> (connexion avec GitHub), puis un projet `ronde`, région **AWS Europe Central 1 (Frankfurt)**.
2. Copier la chaîne de connexion (*Connection string*, format `postgresql://…neon.tech/neondb?sslmode=require`).

## 2. Back-office — Vercel

1. <https://vercel.com/new> → importer `mcpolo78/ronde`.
2. **Root Directory** : `apps/web` (le reste est lu dans `vercel.json`).
3. Variable d'environnement : `API_URL` = `https://ronde-api-nc26.onrender.com` (URL Render de l'étape 3).
4. Déployer et noter l'URL de production, ici `https://ronde-app.vercel.app`.

## 3. API — Render

1. <https://dashboard.render.com> → **New → Blueprint** → dépôt `mcpolo78/ronde`.
2. Renseigner les valeurs demandées :
   - `DATABASE_URL` : chaîne Neon ;
   - `BETTER_AUTH_URL` et `CORS_ORIGINS` : URL Vercel de l'étape 2.
3. Le build installe l'API, génère le client Prisma et **applique les migrations** (`prisma migrate deploy`).
4. Vérifier : `https://ronde-api-nc26.onrender.com/health` répond `ok`.

Si l'URL Render est différente de `ronde-api-nc26.onrender.com`, mettre à jour `API_URL` sur Vercel et redéployer.

## 4. Données de démo et réveil de l'API — GitHub Actions

Le workflow [`demo.yml`](../.github/workflows/demo.yml) :

- régénère chaque nuit les données de démo (elles sont relatives à « aujourd'hui ») ;
- ne réveille plus l'API : c'est la page de connexion qui la réveille et fait patienter le visiteur (l'offre gratuite de Render la met en veille après 15 minutes).

Il ne s'active qu'une fois configuré :

```bash
gh secret set DEMO_DATABASE_URL          # coller la chaîne Neon quand elle est demandée
gh variable set DEMO_API_URL --body "https://ronde-api-nc26.onrender.com"
gh workflow run demo.yml                 # premier remplissage de la base
```

Le seed efface toutes les données : il refuse de s'exécuter sur une base distante sans `RONDE_DEMO_SEED=true`, que seul ce workflow définit.
