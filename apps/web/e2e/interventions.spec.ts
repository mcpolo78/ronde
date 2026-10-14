import { expect, login, test } from "./helpers";

test.beforeEach(async ({ page }) => {
  await login(page);
});

test("le tableau de bord affiche l'activité du jour et les indicateurs", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
  await expect(page.getByText("Interventions aujourd'hui")).toBeVisible();
  await expect(page.getByText("Résolution à la 1re visite")).toBeVisible();
  await expect(page.getByText("En direct")).toBeVisible(); // abonnement temps réel actif
});

test("créer une intervention puis l'annuler", async ({ page }) => {
  await page.getByRole("link", { name: "Nouvelle intervention" }).first().click();
  await expect(page.getByRole("heading", { name: "Nouvelle intervention" })).toBeVisible();

  // Validation : fin avant début
  await page.getByLabel("Client et site").selectOption({ index: 1 });
  await page.getByLabel("Type d'intervention").fill("Contrôle VMC");
  await page.getByLabel("Début").fill("15:00");
  await page.getByLabel("Fin").fill("14:00");
  await page.getByRole("button", { name: "Créer l'intervention" }).click();
  await expect(page.getByText("L'heure de fin doit être après l'heure de début.")).toBeVisible();

  await page.getByLabel("Fin").fill("16:00");
  await page.getByLabel("Technicien", { exact: true }).selectOption({ label: "Julie Moreau" });
  await page.getByRole("button", { name: "Créer l'intervention" }).click();

  await expect(page).toHaveURL(/\/interventions\/[a-z0-9]+\?created=1/);
  await expect(page.getByRole("status").filter({ hasText: "créée" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Contrôle VMC" })).toBeVisible();
  await expect(page.getByRole("main").getByText("Julie Moreau").filter({ visible: true })).toBeVisible();

  await page.getByRole("button", { name: "Annuler l'intervention" }).click();
  await page.getByRole("button", { name: "Confirmer l'annulation" }).click();
  await expect(page.locator("header").getByText("Annulée")).toBeVisible();
  await expect(page.getByRole("button", { name: "Annuler l'intervention" })).toBeHidden();
});

test("filtrer la liste par statut", async ({ page }) => {
  await page.goto("/interventions");
  await page.getByRole("group", { name: "Statuts" }).getByText("Terminée").click();
  await page.getByRole("button", { name: "Filtrer" }).click();
  await expect(page).toHaveURL(/status=DONE/);
  const rows = page.getByRole("table").getByRole("row");
  await expect(rows.nth(1)).toBeVisible();
  // toutes les lignes affichées sont terminées
  const statuses = await page.getByRole("table").locator("tbody tr td:last-child").allInnerTexts();
  expect(statuses.every((s) => s.includes("Terminée"))).toBe(true);
});
