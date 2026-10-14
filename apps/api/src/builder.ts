import SchemaBuilder from "@pothos/core";
import PrismaPlugin from "@pothos/plugin-prisma";
import { DateTimeResolver } from "graphql-scalars";
import { GraphQLError } from "graphql";
import type { Context, Viewer } from "./context";
import { prisma } from "./db";
import type PrismaTypes from "./generated/pothos-types";
import { getDatamodel } from "./generated/pothos-types";

export const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Context: Context;
  Scalars: { DateTime: { Input: Date; Output: Date } };
  DefaultFieldNullability: false;
}>({
  defaultFieldNullability: false,
  plugins: [PrismaPlugin],
  prisma: {
    client: prisma,
    dmmf: getDatamodel(),
    exposeDescriptions: true,
    filterConnectionTotalCount: true,
    onUnusedQuery: process.env.NODE_ENV === "production" ? null : "warn",
  },
});

builder.addScalarType("DateTime", DateTimeResolver);

export function requireViewer(ctx: Context, role?: Viewer["role"]): Viewer {
  if (!ctx.viewer) {
    throw new GraphQLError("Authentification requise", { extensions: { code: "UNAUTHENTICATED" } });
  }
  if (role && ctx.viewer.role !== role) {
    throw new GraphQLError("Action non autorisée pour ce rôle", { extensions: { code: "FORBIDDEN" } });
  }
  return ctx.viewer;
}
