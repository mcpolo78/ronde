/**
 * Base PostgreSQL locale pour le développement — sans Docker.
 * Lance un vrai serveur PostgreSQL 17 (binaires officiels fournis par le paquet npm
 * `embedded-postgres`), avec des données conservées dans apps/api/.pgdata.
 *
 *   pnpm db:dev      (laisser tourner ; Ctrl+C pour arrêter)
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";

const PORT = 5433; // évite un éventuel PostgreSQL déjà installé sur 5432
const DATABASE = "ronde";
const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), "../.pgdata");

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: PORT,
  persistent: true,
  onLog: () => {},
  onError: (message) => console.error(String(message).trim()),
});

if (!existsSync(resolve(dataDir, "PG_VERSION"))) {
  console.log("Première exécution : initialisation de la base…");
  await pg.initialise();
}
await pg.start();
await pg.createDatabase(DATABASE).catch(() => {}); // existe déjà

console.log(`PostgreSQL prêt : postgres://postgres:postgres@localhost:${PORT}/${DATABASE}`);
console.log("Ctrl+C pour arrêter.");

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
