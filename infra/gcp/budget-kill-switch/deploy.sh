#!/usr/bin/env bash
# Budget mensuel (1 € par défaut) + fonction qui coupe la facturation du projet s'il est dépassé.
# Appelé par ../setup.sh ; relançable seul : PROJECT_ID=… BILLING_ACCOUNT=… bash deploy.sh
set -euo pipefail
: "${PROJECT_ID:?}" ; : "${BILLING_ACCOUNT:?}"
REGION="${REGION:-europe-west3}"
BUDGET_EUR="${BUDGET_EUR:-1}"
DIR="$(cd "$(dirname "$0")" && pwd)"
exists() { "$@" >/dev/null 2>&1; }

exists gcloud pubsub topics describe billing-alerts --project "$PROJECT_ID" \
  || gcloud pubsub topics create billing-alerts --project "$PROJECT_ID"

# Budget limité à ce projet, alertes à 50 %, 90 % et 100 % (e-mail aux administrateurs du compte)
if ! gcloud billing budgets list --billing-account "$BILLING_ACCOUNT" --billing-project "$PROJECT_ID" --format 'value(displayName)' | grep -qx "ronde-api"; then
  gcloud billing budgets create --billing-account "$BILLING_ACCOUNT" --billing-project "$PROJECT_ID" --display-name ronde-api \
    --budget-amount "${BUDGET_EUR}EUR" --filter-projects "projects/$PROJECT_ID" \
    --threshold-rule percent=0.5 --threshold-rule percent=0.9 --threshold-rule percent=1.0 \
    --notifications-rule-pubsub-topic "projects/$PROJECT_ID/topics/billing-alerts"
fi

# Compte de service de la fonction : le droit de détacher la facturation de CE projet
KILL_SA="billing-kill-switch@$PROJECT_ID.iam.gserviceaccount.com"
exists gcloud iam service-accounts describe "$KILL_SA" --project "$PROJECT_ID" \
  || gcloud iam service-accounts create billing-kill-switch --project "$PROJECT_ID" --display-name "Coupe-circuit facturation"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$KILL_SA" \
  --role roles/billing.projectManager --condition None >/dev/null

gcloud functions deploy billing-kill-switch --project "$PROJECT_ID" --gen2 --region "$REGION" \
  --runtime nodejs22 --source "$DIR" --entry-point stopBilling \
  --trigger-topic billing-alerts --service-account "$KILL_SA" \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=$PROJECT_ID" \
  --memory 256Mi --max-instances 1 --quiet
# Le déclencheur Pub/Sub appelle la fonction avec ce compte : il lui faut le droit d'invocation
gcloud run services add-iam-policy-binding billing-kill-switch --project "$PROJECT_ID" --region "$REGION" \
  --member "serviceAccount:$KILL_SA" --role roles/run.invoker >/dev/null

echo "Budget ${BUDGET_EUR} € et coupe-circuit en place."
