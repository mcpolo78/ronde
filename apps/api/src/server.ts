import { createYoga } from "graphql-yoga";
import { trustedOrigins } from "./auth";
import { createContext } from "./context";
import { schema } from "./schema";

export const yoga = createYoga({
  schema,
  context: createContext,
  graphqlEndpoint: "/graphql",
  cors: { origin: trustedOrigins, credentials: true },
  graphiql: process.env.NODE_ENV !== "production" && {
    title: "Ronde API",
    headers:
      process.env.ALLOW_DEV_IMPERSONATION === "true"
        ? JSON.stringify({ "x-dev-user": "claire@ronde.demo" })
        : undefined,
  },
});
