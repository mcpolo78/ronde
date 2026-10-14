# 0002 — GraphQL code-first avec Pothos et Prisma

- **Statut** : acceptée
- **Date** : 2026-10-14

## Contexte

Les deux clients ont des besoins très différents sur les mêmes données : le back-office charge des listes et des agrégats sur une période ; le mobile charge la journée d'un technicien avec tout le détail (site, checklist, photos) pour la garder hors ligne. Le back-office doit aussi être notifié en temps réel des changements de statut.

## Options étudiées

1. **REST** : simple, mais demande soit plusieurs endpoints par écran, soit des endpoints taillés sur mesure pour chaque client.
2. **GraphQL schema-first** (SDL écrit à la main + resolvers) : risque de divergence entre le schéma et le code.
3. **GraphQL code-first avec Pothos + plugin Prisma** : le schéma est écrit en TypeScript et typé à partir du modèle Prisma.

## Décision

Option 3, servie par **GraphQL Yoga** :

- **Pothos** génère le schéma depuis le code ; le plugin Prisma regroupe les relations demandées en requêtes SQL optimisées, ce qui évite le problème N+1 sans DataLoader écrit à la main.
- **Subscriptions via SSE** (intégrées à Yoga) pour le temps réel : plus simple à héberger que des WebSockets, et suffisant puisque le flux va du serveur vers le back-office.
- Le schéma SDL est exporté dans `packages/graphql/schema.graphql` (`pnpm codegen`) ; les clients en dérivent leurs types.
- Les erreurs métier sont renvoyées avec un `extensions.code` stable (`MISSING_SIGNATURE`, `FORBIDDEN_FOR_ROLE`…) pour que les clients puissent afficher un message adapté.

## Conséquences

- ✅ Typage de bout en bout : Prisma → Pothos → SDL → clients.
- ✅ Chaque client demande exactement les champs dont il a besoin.
- ⚠️ Le cache HTTP est moins naturel qu'en REST ; le cache est géré côté client (urql/graphcache).
- ⚠️ Les autorisations sont vérifiées dans chaque resolver (`requireViewer`) ; à revoir si les règles se complexifient (plugin scope-auth de Pothos).
