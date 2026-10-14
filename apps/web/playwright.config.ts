import { defineConfig, devices } from "@playwright/test";

/**
 * Parcours E2E du back-office, contre l'API et une base remplie par `pnpm db:seed`.
 * En local : Chrome installé sur la machine (aucun navigateur à télécharger).
 * En CI : Chromium de Playwright (`PLAYWRIGHT_CHANNEL=chromium`).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // les tests partagent la base de démo
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @ronde/api dev",
      url: "http://localhost:4000/health",
      reuseExistingServer: true,
      cwd: "../..",
    },
    {
      command: "pnpm --filter @ronde/web dev",
      url: "http://localhost:3000/login",
      reuseExistingServer: true,
      cwd: "../..",
    },
  ],
});
