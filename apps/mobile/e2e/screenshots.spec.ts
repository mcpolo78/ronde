import { expect, test } from "@playwright/test";
import { createInterventionForKarim } from "./api";

// Captures pour le README : `SCREENSHOTS=1 pnpm --filter @ronde/mobile test:e2e screenshots`
test.skip(!process.env.SCREENSHOTS, "captures à la demande uniquement");
test.use({ deviceScaleFactor: 2 });

const out = (name: string) => `../../docs/screenshots/${name}.png`;

test("captures de l'app technicien", async ({ page, request }) => {
  await createInterventionForKarim(request, "Entretien pompe à chaleur", 20);
  await page.goto("/");
  await page.screenshot({ path: out("mobile-connexion") });
  await page.getByLabel("Mot de passe").fill("demo-ronde");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByTestId("sync-status")).toContainText("À jour");
  await page.screenshot({ path: out("mobile-journee") });

  await page.getByRole("link", { name: /Entretien pompe à chaleur/ }).last().click();
  await page.getByRole("button", { name: "Je pars" }).click();
  await page.getByRole("button", { name: "Je suis arrivé" }).click();
  await expect(page.getByTestId("sync-status").filter({ visible: true })).toContainText("À jour");
  await page.screenshot({ path: out("mobile-intervention") });

  await page.getByRole("button", { name: "Faire signer le client" }).click();
  const pad = (await page.getByTestId("signature-pad").boundingBox())!;
  await page.mouse.move(pad.x + 40, pad.y + 130);
  await page.mouse.down();
  for (let x = 40; x <= 300; x += 8) await page.mouse.move(pad.x + x, pad.y + 110 - Math.sin(x / 22) * 45 + (x % 40));
  await page.mouse.up();
  await page.screenshot({ path: out("mobile-signature") });
});
