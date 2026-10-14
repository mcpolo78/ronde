# 0001 — Monorepo Turborepo + pnpm

- **Statut** : acceptée
- **Date** : 2026-10-14

## Contexte

Ronde se compose d'une API, d'un back-office web et d'une app mobile. Les trois manipulent les mêmes notions (intervention, statut, rôle) et doivent appliquer les mêmes règles métier, en particulier les transitions de statut, que le mobile applique de façon optimiste hors ligne et que l'API revalide.

## Décision

Un seul dépôt géré par **pnpm workspaces** et orchestré par **Turborepo** :

- `apps/api`, `apps/web`, `apps/mobile` ;
- `packages/domain` pour les règles métier pures (sans dépendance à un framework), testées unitairement ;
- `packages/graphql` pour le schéma SDL exporté par l'API, à partir duquel les clients génèrent leurs types ;
- `packages/config` pour la configuration TypeScript partagée.

Les packages internes sont consommés **en source TypeScript** (`exports` vers `src/index.ts`) : pas d'étape de build, Next.js les transpile via `transpilePackages`, Metro et `tsx` les lisent directement.

## Conséquences

- ✅ Une règle métier modifiée est immédiatement prise en compte partout, et un changement de schéma GraphQL casse le typecheck des clients plutôt que la production.
- ✅ Une seule CI, une seule PR pour une fonctionnalité qui touche l'API et les clients.
- ⚠️ Les apps n'utilisent pas toutes la même version de React (Next.js suit la dernière, Expo la version qu'il supporte). pnpm isole les dépendances par projet, mais il ne faut pas partager de composants React entre web et mobile sans précaution : le design system partagé se limitera d'abord aux tokens (couleurs, espacements, typographie).
- ⚠️ La CI construit tout à chaque fois ; à surveiller si le temps de build devient un problème (cache distant Turborepo).
