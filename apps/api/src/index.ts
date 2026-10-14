import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { toNodeHandler } from "better-auth/node";
import { auth, trustedOrigins } from "./auth";
import { handleFiles } from "./files";
import { yoga } from "./server";

const port = Number(process.env.PORT ?? 4000);
const authHandler = toNodeHandler(auth);

/**
 * CORS des routes hors GraphQL (Yoga gère le sien). Seuls les clients sur une autre origine
 * en ont besoin : l'app Expo en version web pendant le développement et les tests.
 * Le back-office passe par le proxy Next.js (même origine) et l'app native n'est pas soumise au CORS.
 * Renvoie `true` si la requête (pré-vol) est terminée.
 */
function cors(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin;
  if (origin && trustedOrigins.includes(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("access-control-allow-credentials", "true");
    res.setHeader("vary", "origin");
  }
  if (req.method === "OPTIONS") {
    res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
    res.setHeader("access-control-allow-headers", "content-type,x-client-id,cookie,expo-origin");
    res.writeHead(204).end();
    return true;
  }
  return false;
}

createServer((req, res) => {
  if (req.url?.startsWith("/api/auth/")) return cors(req, res) || authHandler(req, res);
  if (req.url?.startsWith("/api/files")) return cors(req, res) || handleFiles(req, res);
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain" }).end("ok");
    return;
  }
  return yoga(req, res);
}).listen(port, () => {
  console.log(`Ronde API prête sur http://localhost:${port}${yoga.graphqlEndpoint}`);
});
