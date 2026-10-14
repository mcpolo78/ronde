import { builder, requireViewer } from "../builder";
import { prisma } from "../db";
import { pubsub } from "../pubsub";

builder.subscriptionType({
  fields: (t) => ({
    interventionUpdated: t.prismaField({
      type: "Intervention",
      description: "Émis à chaque création, replanification ou changement de statut (back-office en direct).",
      subscribe: (_root, _args, ctx) =>
        pubsub.subscribe("intervention:updated", requireViewer(ctx).companyId),
      resolve: (query, payload: { interventionId: string }) =>
        prisma.intervention.findUniqueOrThrow({ ...query, where: { id: payload.interventionId } }),
    }),
  }),
});
