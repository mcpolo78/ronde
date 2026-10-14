import { canTransition, createInterventionSchema } from "@ronde/domain";
import { GraphQLError } from "graphql";
import { builder, requireViewer } from "../builder";
import { prisma } from "../db";
import { pubsub } from "../pubsub";
import { InterventionStatusEnum, PriorityEnum } from "./enums";

const CreateInterventionInput = builder.inputType("CreateInterventionInput", {
  fields: (t) => ({
    siteId: t.id({ required: true }),
    type: t.string({ required: true }),
    description: t.string(),
    priority: t.field({ type: PriorityEnum }),
    scheduledStart: t.field({ type: "DateTime", required: true }),
    scheduledEnd: t.field({ type: "DateTime", required: true }),
    technicianId: t.id(),
  }),
});

const ChangeStatusInput = builder.inputType("ChangeStatusInput", {
  fields: (t) => ({
    interventionId: t.id({ required: true }),
    status: t.field({ type: InterventionStatusEnum, required: true }),
    /** Horodatage réel côté mobile : l'action a pu être faite hors ligne. */
    at: t.field({ type: "DateTime", required: true }),
    /** UUID généré par le client : rend la mutation idempotente. */
    clientId: t.string({ required: true }),
  }),
});

const notFound = () =>
  new GraphQLError("Intervention introuvable", { extensions: { code: "NOT_FOUND" } });

async function nextReference(companyId: string) {
  const year = new Date().getFullYear();
  const count = await prisma.intervention.count({ where: { companyId } });
  return `INT-${year}-${String(count + 1).padStart(4, "0")}`;
}

builder.mutationType({
  fields: (t) => ({
    createIntervention: t.prismaField({
      type: "Intervention",
      args: { input: t.arg({ type: CreateInterventionInput, required: true }) },
      resolve: async (query, _root, { input }, ctx) => {
        const viewer = requireViewer(ctx, "MANAGER");
        const parsed = createInterventionSchema.safeParse({
          ...input,
          siteId: String(input.siteId),
          technicianId: input.technicianId ? String(input.technicianId) : undefined,
          priority: input.priority ?? undefined,
          description: input.description ?? undefined,
        });
        if (!parsed.success) {
          throw new GraphQLError("Données invalides", {
            extensions: { code: "BAD_USER_INPUT", issues: parsed.error.issues },
          });
        }
        const data = parsed.data;
        const site = await prisma.site.findFirst({
          where: { id: data.siteId, customer: { companyId: viewer.companyId } },
        });
        if (!site) throw new GraphQLError("Site introuvable", { extensions: { code: "NOT_FOUND" } });

        const created = await prisma.intervention.create({
          ...query,
          data: {
            ...data,
            companyId: viewer.companyId,
            reference: await nextReference(viewer.companyId),
          },
        });
        pubsub.publish("intervention:updated", viewer.companyId, { interventionId: created.id });
        return created;
      },
    }),

    scheduleIntervention: t.prismaField({
      type: "Intervention",
      description: "Replanifie et/ou réassigne une intervention (glisser-déposer du planning).",
      args: {
        id: t.arg.id({ required: true }),
        scheduledStart: t.arg({ type: "DateTime", required: true }),
        scheduledEnd: t.arg({ type: "DateTime", required: true }),
        technicianId: t.arg.id({ required: false }),
      },
      resolve: async (query, _root, args, ctx) => {
        const viewer = requireViewer(ctx, "MANAGER");
        if (args.scheduledEnd <= args.scheduledStart) {
          throw new GraphQLError("La fin du créneau doit être après le début", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }
        const existing = await prisma.intervention.findFirst({
          where: { id: String(args.id), companyId: viewer.companyId },
        });
        if (!existing) throw notFound();
        if (existing.status === "DONE" || existing.status === "CANCELLED") {
          throw new GraphQLError("Intervention clôturée", { extensions: { code: "CONFLICT" } });
        }
        const updated = await prisma.intervention.update({
          ...query,
          where: { id: existing.id },
          data: {
            scheduledStart: args.scheduledStart,
            scheduledEnd: args.scheduledEnd,
            ...(args.technicianId !== undefined
              ? { technicianId: args.technicianId ? String(args.technicianId) : null }
              : {}),
          },
        });
        pubsub.publish("intervention:updated", viewer.companyId, { interventionId: updated.id });
        return updated;
      },
    }),

    changeStatus: t.prismaField({
      type: "Intervention",
      args: { input: t.arg({ type: ChangeStatusInput, required: true }) },
      resolve: async (query, _root, { input }, ctx) => {
        const viewer = requireViewer(ctx);
        const id = String(input.interventionId);
        const scope = {
          id,
          companyId: viewer.companyId,
          ...(viewer.role === "TECHNICIAN" ? { technicianId: viewer.id } : {}),
        };

        // Idempotence : une mutation déjà appliquée renvoie simplement l'état courant.
        const replay = await prisma.statusEvent.findUnique({ where: { clientId: input.clientId } });
        if (replay) {
          const current = await prisma.intervention.findFirst({ ...query, where: scope });
          if (!current) throw notFound();
          return current;
        }

        const existing = await prisma.intervention.findFirst({
          where: scope,
          select: { id: true, status: true, signature: { select: { id: true } } },
        });
        if (!existing) throw notFound();

        const check = canTransition(existing.status, input.status, {
          role: viewer.role,
          hasSignature: Boolean(existing.signature),
        });
        if (!check.ok) {
          throw new GraphQLError(`Transition refusée : ${check.reason}`, {
            extensions: { code: check.reason, current: existing.status },
          });
        }

        const [, updated] = await prisma.$transaction([
          prisma.statusEvent.create({
            data: {
              clientId: input.clientId,
              status: input.status,
              at: input.at,
              interventionId: id,
              authorId: viewer.id,
            },
          }),
          prisma.intervention.update({ ...query, where: { id }, data: { status: input.status } }),
        ]);
        pubsub.publish("intervention:updated", viewer.companyId, { interventionId: id });
        return updated;
      },
    }),

    toggleChecklistItem: t.prismaField({
      type: "ChecklistItem",
      args: { id: t.arg.id({ required: true }), checked: t.arg.boolean({ required: true }) },
      resolve: async (query, _root, args, ctx) => {
        const viewer = requireViewer(ctx, "TECHNICIAN");
        const item = await prisma.checklistItem.findFirst({
          where: { id: String(args.id), intervention: { technicianId: viewer.id } },
        });
        if (!item) {
          throw new GraphQLError("Élément introuvable", { extensions: { code: "NOT_FOUND" } });
        }
        return prisma.checklistItem.update({
          ...query,
          where: { id: item.id },
          data: { checked: args.checked },
        });
      },
    }),
  }),
});
