# Ronde

[![CI](https://github.com/mcpolo78/ronde/actions/workflows/ci.yml/badge.svg)](https://github.com/mcpolo78/ronde/actions/workflows/ci.yml)

> Planifiez, suivez et clôturez les interventions de vos techniciens — même sans réseau.

Ronde est une plateforme métier pour les PME de maintenance (chauffage, bornes de recharge, VMC…) :

- **Back-office web** (Next.js) pour la responsable planning : planning glisser-déposer, carte, suivi en direct, indicateurs.
- **App mobile** (Expo) pour les techniciens : journée préchargée, statuts, photos, signature client, **fonctionnement hors ligne**.

Pourquoi ce projet, pour qui, et comment on mesure son succès : voir [docs/discovery.md](docs/discovery.md).

### Le back-office

- **Tableau de bord** : activité du jour par technicien, interventions à traiter, indicateurs sur 30 jours (résolution à la 1re visite, durée sur site, retard moyen).
- **Planning** de la semaine : glisser-déposer vers un autre technicien ou un autre jour, mise à jour optimiste, et une **alternative clavier** (bouton « Déplacer ») avec annonces pour lecteurs d'écran.
- **Liste filtrable** (statut, technicien, semaine) — les filtres sont un formulaire GET : ils fonctionnent sans JavaScript et l'URL est partageable.
- **Fiche intervention** : client, accès, checklist, historique horodaté des statuts, preuves de passage ; annulation avec confirmation.
- **Création** avec les mêmes règles de validation que l'API (schémas Zod partagés).
- **Temps réel** : les changements faits sur le terrain apparaissent sans recharger (subscription GraphQL en SSE).

## Architecture

```
ronde/
├─ apps/
│  ├─ api/        Node · GraphQL Yoga · Pothos · Prisma 7 · PostgreSQL
│  ├─ web/        Next.js 16 (App Router, Cache Components) · Tailwind CSS 4 · Better Auth · dnd-kit
│  └─ mobile/     Expo SDK 57 · Expo Router
├─ packages/
│  ├─ domain/     règles métier pures et testées (cycle de vie, indicateurs, validations Zod)
│  ├─ graphql/    schéma SDL exporté par l'API + gql.tada → requêtes typées côté clients
│  └─ config/     configuration TypeScript partagée
└─ docs/          discovery + décisions d'architecture (ADR)
```

Les règles métier (qui peut passer une intervention de quel statut à quel autre, signature obligatoire pour clôturer…) vivent **une seule fois** dans `packages/domain` : l'API les applique côté serveur, l'app mobile les utilise pour ses mises à jour optimistes hors ligne.

### Décisions d'architecture

| # | Décision |
|---|---|
| [0001](docs/adr/0001-monorepo.md) | Monorepo Turborepo + pnpm |
| [0002](docs/adr/0002-graphql-code-first.md) | GraphQL code-first avec Pothos et Prisma |
| [0003](docs/adr/0003-offline-first-mobile.md) | Mobile offline-first : mutations idempotentes |
| [0004](docs/adr/0004-auth-et-acces-api-web.md) | Authentification et accès à l'API depuis le back-office (proxy first-party) |

## Démarrer en local

Prérequis : Node 24, pnpm. **Pas besoin de Docker** : la base Postgres locale est fournie par `prisma dev`.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm db:dev                             # Postgres locale (l'URL affichée doit correspondre à .env)
pnpm codegen                            # client Prisma + schéma GraphQL
pnpm db:push && pnpm db:seed            # tables + données de démo
pnpm dev                                # API :4000 · web :3000 · Expo :8081
```

Back-office : <http://localhost:3000> · GraphiQL : <http://localhost:4000/graphql>.

**Comptes de démo** — mot de passe `demo-ronde` :

| Rôle | Email |
|---|---|
| Responsable planning | `claire@ronde.demo` |
| Technicien (app mobile) | `karim@ronde.demo` |

En développement, l'en-tête `x-dev-user: <email>` permet aussi d'interroger l'API sans session (GraphiQL), si `ALLOW_DEV_IMPERSONATION=true`.

## Qualité

```bash
pnpm typecheck   # TypeScript strict partout
pnpm lint
pnpm test        # Vitest (règles métier, dates en heure de Paris)
pnpm --filter @ronde/web test:e2e   # Playwright : parcours complets dans un vrai navigateur
```

Les tests E2E couvrent la connexion, les redirections, le rôle technicien, la création avec validation, l'annulation, les filtres, le déplacement au clavier et à la souris dans le planning. Ils **échouent aussi en cas d'erreur dans la console du navigateur** (hydratation, exceptions).

La CI GitHub Actions exécute tout cela à chaque push et pull request, E2E compris (Postgres en service, Chromium headless).

## Avancement

- [x] **S1** — Monorepo, CI, modèle de données, API GraphQL (requêtes, mutations, temps réel), données de démo, règles métier testées
- [x] **S2** — Authentification, back-office : tableau de bord, planning glisser-déposer, liste, fiche, création, temps réel, tests E2E
- [ ] **S3** — App technicien : journée, statuts, photos, signature, hors ligne
- [ ] **S4** — Carte, notifications, tests E2E mobile (Maestro), audit accessibilité et performance, déploiement

## Roadmap (hors V1)

Facturation et devis · gestion multi-entreprises · gestion des stocks de pièces · géolocalisation en arrière-plan.
