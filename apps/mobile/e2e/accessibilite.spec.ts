import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createInterventionForKarim } from "./api";

/** Audit WCAG 2.2 AA (axe-core) des écrans de l'app technicien, en clair et en sombre. */
async function audit(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    aide: v.help,
    cibles: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
  }));
}

const run = Date.now().toString(36).slice(-5);

for (const colorScheme of ["light", "dark"] as const) {
  test(`écrans de l'app technicien (mode ${colorScheme === "light" ? "clair" : "sombre"})`, async ({ page, request }) => {
    await page.emulateMedia({ colorScheme });
    await createInterventionForKarim(request, `Audit ${colorScheme} ${run}`, 20);

    await page.goto("/");
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
    expect(await audit(page), "connexion").toEqual([]);

    await page.getByLabel("Mot de passe").fill("demo-ronde");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByTestId("sync-status")).toContainText("À jour");
    expect(await audit(page), "ma journée").toEqual([]);

    await page.getByRole("link", { name: new RegExp(`Audit ${colorScheme} ${run}`) }).click();
    await page.getByRole("button", { name: "Je pars" }).click();
    await page.getByRole("button", { name: "Je suis arrivé" }).click();
    await expect(page.getByRole("button", { name: "Faire signer le client" })).toBeVisible();
    expect(await audit(page), "fiche intervention").toEqual([]);

    await page.getByRole("button", { name: "Faire signer le client" }).click();
    await expect(page.getByTestId("signature-pad")).toBeVisible();
    expect(await audit(page), "signature").toEqual([]);
  });
}
