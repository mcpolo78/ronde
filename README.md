# Ronde

[![CI](https://github.com/mcpolo78/ronde/actions/workflows/ci.yml/badge.svg)](https://github.com/mcpolo78/ronde/actions/workflows/ci.yml)

> Planifiez, suivez et clôturez les interventions de vos techniciens — même sans réseau.

Ronde est une plateforme métier pour les PME de maintenance (chauffage, bornes de recharge, VMC…) :

- **Back-office web** (Next.js) pour la responsable planning : planning glisser-déposer, carte, suivi en direct, indicateurs.
- **App mobile** (Expo) pour les techniciens : journée préchargée, statuts, photos, signature client, **fonctionnement hors ligne**.

Pourquoi ce projet, pour qui, et comment on mesure son succès : voir [docs/discovery.md](docs/discovery.md).

## Architecture

```
ronde/
├─ apps/
│  ├─ api/        Node · GraphQL Yoga · Pothos · Prisma 7 · PostgreSQL
│  ├─ web/        Next.js 16 (App Router) · Tailwind CSS 4
│  └─ mobile/     Expo SDK 57 · Expo Router
├─ packages/
│  ├─ domain/     règles métier pures et testées (cycle de vie, indicateurs, validations Zod)
│  ├─ graphql/    schéma SDL exporté par l'API → types des clients
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

GraphiQL : <http://localhost:4000/graphql>.

**Comptes de démo** (S1 : en développement, l'utilisateur est choisi via l'en-tête `x-dev-user`, en attendant l'authentification) :

| Rôle | Email |
|---|---|
| Responsable planning | `claire@ronde.demo` |
| Technicien | `karim@ronde.demo` |

## Qualité

```bash
pnpm typecheck   # TypeScript strict partout
pnpm lint
pnpm test        # Vitest
```

La CI GitHub Actions exécute ces étapes et le build web à chaque push et pull request.

## Avancement

- [x] **S1** — Monorepo, CI, modèle de données, API GraphQL (requêtes, mutations, temps réel), données de démo, règles métier testées
- [ ] **S2** — Authentification, back-office : liste, fiche, création, planning, tableau de bord
- [ ] **S3** — App technicien : journée, statuts, photos, signature, hors ligne
- [ ] **S4** — Carte, notifications, tests E2E (Playwright, Maestro), accessibilité, performance, déploiement

## Roadmap (hors V1)

Facturation et devis · gestion multi-entreprises · gestion des stocks de pièces · géolocalisation en arrière-plan.
