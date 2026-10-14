import { createYoga } from "graphql-yoga";
import { createContext } from "./context";
import { schema } from "./schema";

export const yoga = createYoga({
  schema,
  context: createContext,
  graphqlEndpoint: "/graphql",
  cors: {
    origin: (process.env.CORS_ORIGINS ?? "http://localhost:3000").split(","),
    credentials: true,
  },
  graphiql: process.env.NODE_ENV !== "production" && {
    title: "Ronde API",
    headers: JSON.stringify({ "x-dev-user": "claire@ronde.demo" }),
  },
});
