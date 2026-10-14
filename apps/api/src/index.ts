import { createServer } from "node:http";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";
import { yoga } from "./server";

const port = Number(process.env.PORT ?? 4000);
const authHandler = toNodeHandler(auth);

createServer((req, res) => {
  if (req.url?.startsWith("/api/auth/")) return authHandler(req, res);
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain" }).end("ok");
    return;
  }
  return yoga(req, res);
}).listen(port, () => {
  console.log(`Ronde API prête sur http://localhost:${port}${yoga.graphqlEndpoint}`);
});
