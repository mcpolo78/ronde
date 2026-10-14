// Exporte le schéma SDL pour les clients (web, mobile) : source de leurs types générés.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lexicographicSortSchema, printSchema } from "graphql";

process.env.DATABASE_URL ??= "postgres://unused@localhost/unused"; // pas de connexion à l'import
const { schema } = await import("../src/schema/index.ts");

const out = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/graphql/schema.graphql",
);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, printSchema(lexicographicSortSchema(schema)));
console.log(`Schéma écrit dans ${out}`);
