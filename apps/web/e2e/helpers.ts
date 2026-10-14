import { test as base, expect, type Page } from "@playwright/test";

/** Mot de passe des comptes de démo (voir apps/api/prisma/seed.ts). */
export const DEMO_PASSWORD = "demo-ronde";

/**
 * `test` qui échoue si la page émet une erreur dans la console
 * (erreur d'hydratation, exception non gérée…), même quand l'interface semble fonctionner.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        // 401 attendu lors du test de mauvais mot de passe
        if (message.type() === "error" && !message.text().includes("401")) errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));
      await use(errors);
      expect(errors, "erreurs dans la console du navigateur").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export async function login(page: Page, email = "claire@ronde.demo") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
