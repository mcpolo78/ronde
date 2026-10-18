// Coupe-circuit : un budget GCP n'arrête RIEN par lui-même, il envoie seulement des alertes.
// Cette fonction reçoit les notifications du budget (Pub/Sub) et, dès que le coût dépasse le montant
// du budget, détache le compte de facturation du projet : tous les services payants s'arrêtent.
// Pour relancer : `gcloud billing projects link <projet> --billing-account <compte>` (après vérification).
import { CloudBillingClient } from '@google-cloud/billing';

const billing = new CloudBillingClient();
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT;

export async function stopBilling(event) {
  // CloudEvent ({ data: { message } }) ou ancien format (le message lui-même), selon le déclencheur
  const message = event.data?.message ?? event;
  const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
  const { costAmount, budgetAmount } = data;
  console.log(`Coût ${costAmount} / budget ${budgetAmount}`);
  if (costAmount <= budgetAmount) return;

  const name = `projects/${PROJECT_ID}`;
  const [info] = await billing.getProjectBillingInfo({ name });
  if (!info.billingEnabled) return console.log('Facturation déjà coupée.');
  await billing.updateProjectBillingInfo({ name, projectBillingInfo: { billingAccountName: '' } });
  console.log(`Facturation coupée pour ${PROJECT_ID}.`);
}
