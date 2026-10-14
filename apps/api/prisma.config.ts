import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Valeur de repli : `prisma generate` (CI) n'a pas besoin de base.
    url: process.env.DATABASE_URL ?? "postgres://unused@localhost/unused",
  },
});
