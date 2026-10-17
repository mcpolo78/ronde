# Contribuer à Ronde

Merci de l'intérêt porté au projet. Ce guide explique comment proposer une modification.

## Démarrer

Prérequis : Node 24 (voir `.nvmrc`) et pnpm. Pas besoin de Docker.

```bash
pnpm install
pnpm db:dev                             # PostgreSQL sur :5433, à laisser tourner
pnpm codegen                            # client Prisma, schéma GraphQL, types
pnpm db:deploy && pnpm db:seed          # migrations et données de démo
pnpm dev                                # API :4000, web :3000, Expo :8081
```

## Avant d'ouvrir une PR

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @ronde/web test:e2e       # si le back-office change
pnpm --filter @ronde/mobile test:e2e    # si l'app technicien change
```

La CI rejette aussi un code généré non à jour : relancez `pnpm codegen` et committez le résultat si le schéma GraphQL a changé.

## Issues

- Cherchez d'abord si une issue existe déjà.
- Utilisez les templates « Bug » ou « Fonctionnalité ».
- Pour une première contribution, regardez les issues labellisées `good first issue`.

## Pull requests

- Une PR = un sujet. Évitez de mélanger refactor et fonctionnalité.
- Reliez la PR à son issue avec `Closes #n`.
- Remplissez le template de PR et cochez les vérifications.
- Les modifications de `packages/domain` et de `docs/adr/` demandent une attention particulière : expliquez le pourquoi, pas seulement le quoi.

## Commits

Messages courts au format [Conventional Commits](https://www.conventionalcommits.org/fr/) :

- `feat: ...` nouvelle fonctionnalité
- `fix: ...` correction de bug
- `docs: ...` documentation seule
- `test: ...`, `refactor: ...`, `chore: ...` selon le cas

## Revue

Chaque PR est relue avant fusion. La branche `main` est protégée : la CI doit être verte et la revue approuvée.

## Sécurité

Ne signalez pas une faille dans une issue publique. Voir [SECURITY.md](SECURITY.md).
