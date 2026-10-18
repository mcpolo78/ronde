# Image de l'API pour Cloud Run. Contexte de build = racine du monorepo :
#   docker build -f apps/api/Dockerfile -t ronde-api .
# Étape 1 : installe le monorepo filtré sur l'API, génère Prisma/Pothos, compile en un seul fichier.
# Étape 2 : image d'exécution avec seulement les dépendances de production de l'API.

FROM node:24-slim AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@12.11.2 --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc* ./
COPY apps/api/package.json apps/api/
COPY packages/domain/package.json packages/domain/
COPY packages/config/package.json packages/config/
RUN pnpm install --frozen-lockfile --filter "@ronde/api..."
COPY apps/api apps/api
COPY packages/domain packages/domain
COPY packages/config packages/config
RUN pnpm --filter @ronde/api codegen && pnpm --filter @ronde/api build
# dépendances de production seules, dans un dossier autonome. Sans les pairs installés d'office :
# better-auth déclare Next.js et React Native en pairs optionnels (1,2 Go → ~150 Mo).
RUN pnpm --filter @ronde/api deploy --prod --legacy \
      --config.auto-install-peers=false --config.dedupe-peer-dependents=false /out \
 && cp -r apps/api/dist /out/dist \
 && cp -r apps/api/src/generated /out/generated

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out ./
USER node
# Cloud Run fournit PORT (8080 par défaut)
EXPOSE 8080
CMD ["node", "dist/index.js"]
