import { expect, test } from "@playwright/test";
import { login } from "./helpers";

// Captures pour le README : `SCREENSHOTS=1 pnpm --filter @ronde/web test:e2e screenshots`
test.skip(!process.env.SCREENSHOTS, "captures à la demande uniquement");
test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });

const out = (name: string) => `../../docs/screenshots/${name}.png`;

test("captures du back-office", async ({ page }) => {
  await login(page);
  await expect(page.getByText("Résolution à la 1re visite")).toBeVisible();
  await page.screenshot({ path: out("web-tableau-de-bord") });

  await page.goto("/planning");
  await expect(page.getByRole("table", { name: "Planning de la semaine" })).toBeVisible();
  await page.screenshot({ path: out("web-planning") });

  await page.goto("/interventions?status=DONE");
  await page.getByRole("table").getByRole("link").first().click();
  await expect(page.getByRole("heading", { name: "Historique" })).toBeVisible();
  await page.screenshot({ path: out("web-intervention") });
});
