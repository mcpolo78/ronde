# Banc de mesure de l'API

Mesure des requêtes réelles du back-office et de l'app mobile sur une base volumineuse, avant et après correction.
Tout est rejouable : le jeu de données est déterministe, le script de charge n'a aucune dépendance.

## Résultat en bref

Base : 60 entreprises, 2,4 millions d'interventions, 6,5 millions d'événements de statut, 7,2 millions de lignes de checklist (3,2 Go).
L'entreprise interrogée est la plus grosse : 40 techniciens, 89 000 interventions sur 2 ans.

16 requêtes simultanées pendant 20 s par scénario, temps en millisecondes :

| Scénario | p50 avant | p95 avant | req/s avant | erreurs avant | p50 après | p95 après | req/s après | erreurs après |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| Indicateurs du tableau de bord, 30 jours | 1 041 | 1 226 | 15,9 | 0 | **95** | **141** | **164,9** | 0 |
| Page tableau de bord complète (indicateurs + journée + techniciens) | 1 300 | 1 520 | 12,9 | 0 | **257** | **314** | **62,6** | 0 |
| Indicateurs sur 365 jours | – | – | – | **100 %** | 1 765 | 2 274 | 9,4 | **0** |
| Création d'intervention | 89 | 125 | 176 | **86 %** | 38 | 89 | 363 | **0** |
| Planning d'une semaine | 830 | 940 | 20,0 | 0 | 800 | 1 005 | 20,2 | 0 |
| Formulaire (2 000 sites + techniciens) | 563 | 710 | 28,5 | 0 | 559 | 721 | 28,7 | 0 |
| Liste filtrée (1 technicien, 30 jours) | 120 | 144 | 138 | 0 | 99 | 134 | 156 | 0 |
| Détail d'une intervention | 44 | 54 | 366 | 0 | 39 | 52 | 396 | 0 |
| Ma journée (mobile) | 33 | 43 | 477 | 0 | 31 | 42 | 496 | 0 |

Une requête à la fois (sans file d'attente), p50 : indicateurs 30 jours 75 → 22 ms, création 14 → 5 ms, indicateurs 365 jours erreur → 426 ms.
Les fichiers bruts sont dans [`results/`](results/).

## Ce que la mesure a montré

### 1. Tableau de bord : le goulot était dans l'API, pas dans PostgreSQL

`pg_stat_statements` donnait 15 ms pour la requête des interventions et 18 ms pour celle des événements, alors que
l'utilisateur attendait plus d'une seconde. Le résolveur rapatriait 3 700 interventions et 10 800 événements pour
30 jours, puis calculait les moyennes en JavaScript. Le temps partait dans le transfert, la conversion des lignes en
objets et le calcul, sur le seul fil d'exécution de Node : 16 demandes simultanées attendaient les unes derrière les autres.

Correction : une seule requête d'agrégation ([`src/dashboard.ts`](../src/dashboard.ts)), qui renvoie une ligne.
`bench/verify.ts` compare ses résultats au calcul de référence testé de `packages/domain` sur 17 cas (4 entreprises,
4 périodes, une période vide) : ils concordent exactement.

### 2. Tableau de bord sur un an : 100 % d'erreurs

Pour charger les événements, Prisma envoyait `WHERE "interventionId" IN ($1, $2, …)` avec un paramètre par
intervention. Au-delà de 32 767, PostgreSQL refuse la requête. Une entreprise de 40 techniciens y arrive en 9 mois.
L'agrégation SQL supprime le problème : il n'y a plus de liste d'identifiants.

### 3. Création d'intervention : références en double

La référence `INT-2026-0042` venait d'un `COUNT(*)` suivi d'un `INSERT`. Deux créations simultanées lisaient le même
total et la seconde échouait sur la contrainte d'unicité : 86 % d'échecs à 16 créations simultanées. Le `COUNT(*)`
coûtait aussi 15 ms sur 89 000 lignes, et ce coût grandissait avec l'historique.

Correction : un compteur par entreprise (`Company.lastReferenceNumber`), incrémenté dans la même transaction que
l'insertion. L'`UPDATE` verrouille la ligne de l'entreprise, les créations se suivent, et un échec ne laisse pas de trou
dans la numérotation. La migration `3_reference_counter` reprend la numérotation existante.

### 4. Un index testé, puis écarté

Un index couvrant `StatusEvent (interventionId, status, at)` permet un parcours d'index seul pour l'agrégation.
Mesuré avec `EXPLAIN (ANALYZE, BUFFERS)` : 20 → 17 ms sur 30 jours, 260 → 200 ms sur un an, pour 250 Mo d'index en
plus et des écritures plus lentes sur la table la plus sollicitée par la synchronisation mobile. Le gain ne vaut pas
le coût, l'index existant `(interventionId, at)` reste seul.

## Limites connues

- **Indicateurs sur un an** : la requête passe, mais prend 426 ms seule et 1,8 s à 16 en parallèle. Elle fait
  44 000 recherches d'index dans les événements. La compilation JIT de PostgreSQL en double le temps sur cette requête
  (260 ms avec `jit = off`). Suite logique : enregistrer l'heure d'arrivée et de fin sur l'intervention au moment du
  changement de statut, pour que l'agrégation ne lise plus qu'une table.
- **Planning et formulaire** : inchangés. Le temps est proportionnel au nombre de lignes renvoyées (850 interventions
  avec site, client et technicien ; 2 000 sites). La base répond en moins de 20 ms. La correction est fonctionnelle
  (pagination, recherche de site à la saisie), pas une optimisation de requête.
- Mesures faites sur une seule machine : l'API, la base et le client de charge se partagent 4 cœurs, sans latence
  réseau. Les valeurs absolues ne prédisent pas la production ; les écarts avant/après, si.

## Protocole

- Machine : 4 vCPU Intel Xeon 2,1 GHz, 15 Go de RAM, Linux.
- PostgreSQL 16.15, `shared_buffers = 1GB`, `work_mem = 16MB`, le reste par défaut. Toute la base tient en cache.
- API lancée avec `tsx src/index.ts` (Node 22), un seul processus, pool `pg` par défaut.
- Chaque scénario : 5 requêtes de mise en température, puis 20 s à 16 requêtes simultanées. La base est remise à
  l'état initial avant chaque série.
- « Avant » : commit `82f96d0` (branche `main`). « Après » : cette branche.
- Les scénarios reprennent les requêtes de `apps/web/src/lib/queries.ts` et de l'app mobile, avec leurs vrais champs.

## Rejouer

```bash
# 1. Base de test (attention : seed.sql vide toutes les tables)
pnpm db:dev                                   # ou tout PostgreSQL 16+
pnpm db:deploy
psql "$DATABASE_URL" -f apps/api/bench/seed.sql   # 3 à 5 minutes

# 2. API, avec l'en-tête x-dev-user autorisé
cd apps/api && ALLOW_DEV_IMPERSONATION=true pnpm start

# 3. Charge et vérification
node bench/load.mjs --duration 20 --concurrency 16 --json bench/results/essai.json
pnpm exec tsx --env-file-if-exists=.env bench/verify.ts
```
