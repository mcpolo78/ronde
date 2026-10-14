import { DEMO_PASSWORD, expect, login, test } from "./helpers";

test("une page protégée renvoie vers la connexion", async ({ page }) => {
  await page.goto("/planning");
  await expect(page).toHaveURL(/\/login\?next=%2Fplanning/);
});

test("un mauvais mot de passe affiche une erreur", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Mot de passe").fill("mauvais-mot-de-passe");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Email ou mot de passe incorrect.")).toBeVisible();
});

test("la responsable se connecte, revient sur la page demandée puis se déconnecte", async ({ page }) => {
  await page.goto("/planning");
  await page.getByLabel("Mot de passe").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/planning$/);
  await expect(page.getByRole("heading", { name: "Planning" })).toBeVisible();

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("un technicien est invité à utiliser l'app mobile", async ({ page }) => {
  await login(page, "karim@ronde.demo");
  await expect(page.getByText("réservé aux responsables planning")).toBeVisible();
});
