import { createServer } from "node:http";
import { yoga } from "./server";

const port = Number(process.env.PORT ?? 4000);

createServer(yoga).listen(port, () => {
  console.log(`Ronde API prête sur http://localhost:${port}${yoga.graphqlEndpoint}`);
});
