import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, login, test } from "./helpers";

/**
 * Audit automatique WCAG 2.2 AA (axe-core) de chaque écran du back-office, en clair et en sombre.
 * Ne remplace pas un test avec un lecteur d'écran, mais bloque les régressions courantes :
 * contrastes, libellés manquants, structure des titres, rôles ARIA invalides…
 */
async function audit(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .exclude("nextjs-portal") // outils de développement de Next.js
    .analyze();
  return violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    aide: v.help,
    cibles: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
    pourquoi: v.nodes.slice(0, 3).map((n) => n.failureSummary), // raison donnée par axe (taille, voisin trop proche…)
  }));
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`mode ${colorScheme === "light" ? "clair" : "sombre"}`, () => {
    test.use({ colorScheme });

    test("page de connexion", async ({ page }) => {
      await page.goto("/login");
      expect(await audit(page)).toEqual([]);
    });

    test("écrans du back-office", async ({ page }) => {
      await login(page);
      const screens = [
        { path: "/", ready: page.getByText("Résolution à la 1re visite") },
        { path: "/planning", ready: page.getByRole("table", { name: "Planning de la semaine" }) },
        { path: "/interventions", ready: page.getByRole("table") },
        { path: "/interventions/new", ready: page.getByLabel("Client et site") },
      ];
      for (const { path, ready } of screens) {
        await page.goto(path);
        await expect(ready).toBeVisible();
        expect(await audit(page), `accessibilité de ${path}`).toEqual([]);
      }
      await page.goto("/interventions?status=DONE");
      await page.getByRole("table").getByRole("link").first().click();
      await expect(page.getByRole("heading", { name: "Historique" })).toBeVisible();
      expect(await audit(page), "accessibilité de la fiche intervention").toEqual([]);
    });
  });
}
