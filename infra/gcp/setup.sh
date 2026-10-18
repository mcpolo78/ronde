#!/usr/bin/env bash
# Mise en place GCP de l'API Ronde, à lancer une fois (idempotent : relançable sans casse).
# Prérequis : gcloud installé et connecté (`gcloud auth login`), un compte de facturation créé dans la console.
#
#   PROJECT_ID=ronde-api-xxxx BILLING_ACCOUNT=XXXXXX-XXXXXX-XXXXXX \
#   BACKOFFICE_URL=https://ronde-app.vercel.app GITHUB_REPO=mcpolo78/ronde \
#   bash infra/gcp/setup.sh
#
# Ce que ça crée : projet, APIs, dépôt Artifact Registry, 2 secrets, compte de service d'exécution
# (accès aux secrets seulement), compte de service de déploiement + Workload Identity Federation pour
# GitHub Actions, service Cloud Run « ronde-api » (0 à 1 instance), budget à 1 € avec coupe-circuit.
set -euo pipefail

: "${PROJECT_ID:?PROJECT_ID manquant}"
: "${BILLING_ACCOUNT:?BILLING_ACCOUNT manquant (gcloud billing accounts list)}"
: "${BACKOFFICE_URL:?BACKOFFICE_URL manquant}"
: "${GITHUB_REPO:?GITHUB_REPO manquant (owner/name)}"
REGION="${REGION:-europe-west3}"   # Francfort, comme la base Neon
BUDGET_EUR="${BUDGET_EUR:-1}"

say() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
exists() { "$@" >/dev/null 2>&1; }

say "Projet $PROJECT_ID"
exists gcloud projects describe "$PROJECT_ID" || gcloud projects create "$PROJECT_ID" --name "Ronde API"
gcloud config set project "$PROJECT_ID" >/dev/null
gcloud billing projects link "$PROJECT_ID" --billing-account "$BILLING_ACCOUNT" >/dev/null
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format 'value(projectNumber)')

say "APIs"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com \
  iamcredentials.googleapis.com iam.googleapis.com sts.googleapis.com \
  billingbudgets.googleapis.com cloudbilling.googleapis.com pubsub.googleapis.com \
  cloudfunctions.googleapis.com cloudbuild.googleapis.com eventarc.googleapis.com

say "Artifact Registry"
exists gcloud artifacts repositories describe ronde --location "$REGION" \
  || gcloud artifacts repositories create ronde --repository-format docker --location "$REGION" \
       --description "Images de l'API Ronde"

say "Secrets (DATABASE_URL demandé, BETTER_AUTH_SECRET généré)"
if ! exists gcloud secrets describe DATABASE_URL; then
  read -rsp "DATABASE_URL (chaîne Neon) : " DB_URL; echo
  printf '%s' "$DB_URL" | gcloud secrets create DATABASE_URL --data-file=- --replication-policy automatic
fi
if ! exists gcloud secrets describe BETTER_AUTH_SECRET; then
  echo "Reprendre la valeur de Render garde les sessions ouvertes ; vide = nouvelle valeur (tout le monde se reconnecte)."
  read -rsp "BETTER_AUTH_SECRET (Entrée pour générer) : " AUTH_SECRET; echo
  AUTH_SECRET="${AUTH_SECRET:-$(openssl rand -base64 32)}"
  printf '%s' "$AUTH_SECRET" | gcloud secrets create BETTER_AUTH_SECRET --data-file=- --replication-policy automatic
fi

say "Compte de service d'exécution"
RUN_SA="ronde-api-run@$PROJECT_ID.iam.gserviceaccount.com"
exists gcloud iam service-accounts describe "$RUN_SA" \
  || gcloud iam service-accounts create ronde-api-run --display-name "Ronde API (exécution)"
for s in DATABASE_URL BETTER_AUTH_SECRET; do
  gcloud secrets add-iam-policy-binding "$s" --member "serviceAccount:$RUN_SA" \
    --role roles/secretmanager.secretAccessor >/dev/null
done

say "Premier déploiement (image publique de test, remplacée au premier push)"
if ! exists gcloud run services describe ronde-api --region "$REGION"; then
  gcloud run deploy ronde-api --region "$REGION" --image us-docker.pkg.dev/cloudrun/container/hello \
    --service-account "$RUN_SA" --allow-unauthenticated --quiet
fi
gcloud run services update ronde-api --region "$REGION" \
  --service-account "$RUN_SA" \
  --min-instances 0 --max-instances 1 --concurrency 80 \
  --cpu 1 --memory 512Mi --cpu-throttling --timeout 60 \
  --set-env-vars "NODE_ENV=production,BETTER_AUTH_URL=$BACKOFFICE_URL,CORS_ORIGINS=$BACKOFFICE_URL" \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest,BETTER_AUTH_SECRET=BETTER_AUTH_SECRET:latest" \
  --quiet

say "Compte de service de déploiement + Workload Identity Federation (GitHub Actions)"
DEPLOY_SA="ronde-deploy@$PROJECT_ID.iam.gserviceaccount.com"
exists gcloud iam service-accounts describe "$DEPLOY_SA" \
  || gcloud iam service-accounts create ronde-deploy --display-name "Ronde déploiement (GitHub Actions)"
for role in roles/run.admin roles/artifactregistry.writer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$DEPLOY_SA" --role "$role" \
    --condition None >/dev/null
done
# déployer « en tant que » le compte d'exécution
gcloud iam service-accounts add-iam-policy-binding "$RUN_SA" --member "serviceAccount:$DEPLOY_SA" \
  --role roles/iam.serviceAccountUser >/dev/null
exists gcloud iam workload-identity-pools describe github --location global \
  || gcloud iam workload-identity-pools create github --location global --display-name "GitHub Actions"
exists gcloud iam workload-identity-pools providers describe github --location global --workload-identity-pool github \
  || gcloud iam workload-identity-pools providers create-oidc github --location global \
       --workload-identity-pool github --issuer-uri https://token.actions.githubusercontent.com \
       --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
       --attribute-condition "assertion.repository == '$GITHUB_REPO' && assertion.ref == 'refs/heads/main'"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$GITHUB_REPO" \
  >/dev/null
WIF_PROVIDER="projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github"

say "Budget ${BUDGET_EUR} € + coupe-circuit"
bash "$(dirname "$0")/budget-kill-switch/deploy.sh"

URL=$(gcloud run services describe ronde-api --region "$REGION" --format 'value(status.url)')
cat <<EOF

Terminé. À reporter sur GitHub (Settings → Secrets and variables → Actions) :
  variables : GCP_PROJECT_ID=$PROJECT_ID  GCP_REGION=$REGION
              GCP_WIF_PROVIDER=$WIF_PROVIDER
              GCP_DEPLOY_SA=$DEPLOY_SA
  secret    : DATABASE_URL (même valeur que DEMO_DATABASE_URL)
Ou en ligne de commande :
  gh variable set GCP_PROJECT_ID --body "$PROJECT_ID"
  gh variable set GCP_REGION --body "$REGION"
  gh variable set GCP_WIF_PROVIDER --body "$WIF_PROVIDER"
  gh variable set GCP_DEPLOY_SA --body "$DEPLOY_SA"

URL de l'API : $URL  (répondra « ok » sur /health après le premier déploiement par GitHub Actions)
EOF
