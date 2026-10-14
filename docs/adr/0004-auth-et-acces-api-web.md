# 0004 — Authentification et accès à l'API depuis le back-office

- **Statut** : acceptée
- **Date** : 2026-10-14

## Contexte

- Deux clients s'authentifient : le back-office web (navigateur) et l'app mobile (S3).
- C'est un outil B2B : les comptes sont créés par l'entreprise, il n'y a pas d'inscription publique.
- En production, le back-office (Vercel) et l'API (Render) sont sur des domaines différents. Des cookies de session envoyés d'un domaine à l'autre seraient bloqués par les navigateurs (cookies tiers) ou exigeraient `SameSite=None`.
- Next.js 16 avec Cache Components : toute lecture de session est dynamique et doit être isolée derrière `<Suspense>`.

## Décision

1. **Better Auth dans l'API**, sessions stockées en base (Prisma), connexion email + mot de passe, `disableSignUp: true`. Le rôle et l'entreprise sont des champs de l'utilisateur, renvoyés avec la session.
2. **Le navigateur ne parle qu'au domaine du back-office.** `next.config.ts` relaie `/api/auth/*` et `/api/graphql` vers l'API (rewrites). Le cookie de session est donc « first-party », `httpOnly`, `SameSite=Lax`.
3. **Les Server Components et Server Actions appellent l'API de serveur à serveur** en relayant le cookie (`lib/api.ts`). Aucune donnée métier n'est récupérée côté client, sauf l'abonnement temps réel (SSE via le même proxy).
4. **L'API reste la seule autorité.** Le `proxy.ts` de Next ne fait qu'une vérification optimiste (présence du cookie → sinon `/login`) ; session, rôle et appartenance à l'entreprise sont revérifiés par l'API à chaque requête.
5. **Protection CSRF** : Better Auth refuse les requêtes dont l'origine n'est pas dans `trustedOrigins` (testé : `403 INVALID_ORIGIN`). Les Server Actions de Next ont leur propre contrôle d'origine.
6. **Pages en Partial Prerendering** : chaque page rend immédiatement sa partie statique (titre, actions) ; les données liées à la session sont dans des composants sous `<Suspense>` avec des squelettes.

## Conséquences

- ✅ Pas de cookies tiers ni de CORS côté navigateur ; le back-office fonctionne avec les réglages de confidentialité les plus stricts.
- ✅ Le mobile utilisera la même API d'authentification (plugin Expo de Better Auth, jeton en stockage sécurisé).
- ✅ Navigations instantanées : le build classe toutes les pages en « Partial Prerender ».
- ⚠️ Un saut réseau supplémentaire (navigateur → Next → API) ; négligeable si les deux services sont hébergés dans la même région.
- ⚠️ `cookieCache` (5 min) évite une requête en base par appel GraphQL, mais une session révoquée reste valide jusqu'à 5 min.
