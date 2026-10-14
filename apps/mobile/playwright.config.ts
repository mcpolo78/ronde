import { defineConfig, devices } from "@playwright/test";

/**
 * Parcours E2E de l'app technicien, exécutée dans sa version web (react-native-web).
 * Le réseau est coupé et rétabli par le test (`context.setOffline`) pour vérifier le mode hors ligne.
 * L'API doit tourner avec ALLOW_DEV_IMPERSONATION=true : le test prépare et vérifie les données
 * côté serveur avec l'en-tête `x-dev-user`.
 */
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:8081",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile",
      // un téléphone : écran étroit, tactile simulé, mais avec le moteur Chrome installé
      use: { ...devices["Pixel 7"], channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome" },
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
      command: "pnpm --filter @ronde/mobile exec expo start --web --port 8081",
      url: "http://localhost:8081",
      reuseExistingServer: true,
      timeout: 180_000,
      cwd: "../..",
    },
  ],
});
