import { expect, login, test } from "./helpers";

// Une semaine entièrement à venir : toutes les interventions y sont encore « planifiées »
function nextMonday() {
  const d = new Date();
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

test.beforeEach(async ({ page }) => {
  await login(page);
  await page.goto(`/planning?week=${nextMonday()}`);
  await expect(page.getByRole("table", { name: "Planning de la semaine" })).toBeVisible();
});

const row = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("row").filter({ has: page.getByRole("rowheader", { name }) });

test("déplacer une intervention avec l'alternative clavier", async ({ page }) => {
  const source = row(page, "Thomas Petit");
  const moveButton = source.getByRole("button", { name: /^Déplacer INT-/ }).first();
  const reference = (await moveButton.getAttribute("aria-label"))!.replace("Déplacer ", "");

  await moveButton.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: `Déplacer ${reference}` });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Technicien").selectOption({ label: "Sofia Rossi" });
  await dialog.getByRole("button", { name: "Déplacer" }).click();

  await expect(page.getByText(`${reference} déplacée : Sofia Rossi`)).toBeVisible();
  await expect(row(page, "Sofia Rossi").getByRole("button", { name: `Déplacer ${reference}` })).toBeVisible();

  // persisté côté serveur
  await page.reload();
  await expect(row(page, "Sofia Rossi").getByRole("button", { name: `Déplacer ${reference}` })).toBeVisible();
});

test.describe("souris", () => {
  // grande fenêtre : la carte et la ligne cible doivent être visibles en même temps
  test.use({ viewport: { width: 1600, height: 2400 } });

test("glisser-déposer une intervention vers les non assignées", async ({ page }) => {
  const card = row(page, "Mehdi Haddad").locator("[aria-roledescription='draggable']").first();
  const reference = (await card.getAttribute("aria-label"))!.replace("Glisser ", "");
  const target = row(page, "Non assignées").getByRole("cell").first();

  const from = (await card.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 + 10, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();

  await expect(page.getByText(`${reference} déplacée : Non assignées`)).toBeVisible();
  await expect(row(page, "Non assignées").getByRole("button", { name: `Déplacer ${reference}` })).toBeVisible();
});
});
