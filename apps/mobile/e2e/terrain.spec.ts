import { expect, test, type Page } from "@playwright/test";
import { cancelAsManager, createInterventionForKarim, serverState } from "./api";

// Petite image PNG valide (le mobile la redimensionne et la recompresse en JPEG avant l'envoi)
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR42mNkYPhfz0AEYBxVSF+FAHmRBA8q5kCxAAAAAElFTkSuQmCC",
  "base64",
);

async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Mot de passe").fill("demo-ronde");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: /Bonjour Karim/ })).toBeVisible();
}

// l'écran précédent reste monté (caché) sous la fiche : on cible l'indicateur visible
// nom unique par exécution : les interventions des passages précédents restent dans la journée
const run = Date.now().toString(36).slice(-5);

const status = (page: Page) => page.getByTestId("sync-status").filter({ visible: true });

async function draw(page: Page) {
  const pad = (await page.getByTestId("signature-pad").boundingBox())!;
  await page.mouse.move(pad.x + 30, pad.y + 120);
  await page.mouse.down();
  for (let x = 30; x <= 230; x += 20) await page.mouse.move(pad.x + x, pad.y + 120 - Math.sin(x / 25) * 40);
  await page.mouse.up();
}

test("une intervention complète faite hors ligne arrive intacte au bureau", async ({ page, context, request }) => {
  const { id, reference } = await createInterventionForKarim(request, `Hors ligne ${run}`, 15);
  await login(page);
  await expect(status(page)).toContainText("À jour");

  await page.getByRole("link", { name: new RegExp(`Hors ligne ${run}`) }).click();
  await expect(page.getByRole("heading", { name: `Hors ligne ${run}` })).toBeVisible();

  // ——— le technicien descend en chaufferie : plus de réseau ———
  await context.setOffline(true);

  await page.getByRole("button", { name: "Je pars" }).click();
  await expect(page.getByText("En route", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/1 action en attente d'envoi/)).toBeVisible();
  await page.getByRole("button", { name: "Je suis arrivé" }).click();
  await expect(page.getByText("Sur place", { exact: true }).filter({ visible: true })).toBeVisible();

  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Prendre une photo" }).click();
  await (await chooser).setFiles({ name: "chaudiere.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("En attente", { exact: true })).toBeVisible();

  await page.getByLabel("Compte rendu").fill("Brûleur nettoyé, joint remplacé.");
  await page.getByRole("button", { name: "Enregistrer le compte rendu" }).click();

  // clôturer sans signature est impossible : le bouton propose de faire signer
  await page.getByRole("button", { name: "Faire signer le client" }).click();
  await draw(page);
  await page.getByLabel("Nom du signataire").fill("Mme Durand");
  await page.getByTestId("confirm-signature").click();
  await page.getByRole("button", { name: "Clôturer l'intervention" }).click();

  await expect(page.getByText(/Intervention terminée · signée par Mme Durand/)).toBeVisible();
  await expect(page.getByText(/6 actions en attente d'envoi/)).toBeVisible();

  // rien n'est encore arrivé au bureau
  expect((await serverState(request, id)).status).toBe("PLANNED");

  // ——— retour du réseau ———
  await context.setOffline(false);
  await status(page).click();
  await expect(status(page)).toContainText("À jour", { timeout: 30_000 });

  const server = await serverState(request, id);
  expect(server.status).toBe("DONE");
  expect(server.events.map((e: { status: string }) => e.status)).toEqual(["EN_ROUTE", "ON_SITE", "DONE"]);
  expect(server.photos).toHaveLength(1);
  expect(server.signature.signerName).toBe("Mme Durand");
  expect(server.signature.url).toMatch(/^\/api\/files\//);
  expect(server.report).toBe("Brûleur nettoyé, joint remplacé.");

  // une nouvelle synchronisation ne crée aucun doublon
  await status(page).click();
  await expect(status(page)).toContainText("À jour");
  const again = await serverState(request, id);
  expect(again.events).toHaveLength(3);
  expect(again.photos).toHaveLength(1);
  console.log(`${reference} synchronisée : ${again.events.length} statuts, ${again.photos.length} photo, signature OK`);
});

test("une intervention annulée par le bureau pendant une coupure est signalée au technicien", async ({ page, context, request }) => {
  const { id } = await createInterventionForKarim(request, `Conflit ${run}`, 30);
  await login(page);
  await page.getByRole("link", { name: new RegExp(`Conflit ${run}`) }).click();

  await context.setOffline(true);
  await page.getByRole("button", { name: "Je pars" }).click();
  await expect(page.getByText("En route", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/1 action en attente d'envoi/)).toBeVisible();

  // pendant ce temps, le bureau annule l'intervention
  await cancelAsManager(request, id);

  await context.setOffline(false);
  await status(page).click();

  await expect(page.getByRole("alert")).toContainText("modifiée par le planning");
  await expect(page.getByText("Intervention annulée par le bureau")).toBeVisible();
  expect((await serverState(request, id)).status).toBe("CANCELLED");
});
