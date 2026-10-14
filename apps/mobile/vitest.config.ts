import { defineConfig } from "vitest/config";

// Tests de la logique pure (synchronisation hors ligne) : pas d'environnement React Native.
export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
});
