import { buildSignatureSvg, canTransition, createInterventionSchema, signatureStrokesSchema } from "@ronde/domain";
import { GraphQLError } from "graphql";
import { builder, requireViewer } from "../builder";
import type { Viewer } from "../context";
import { fileUrl } from "../files";
import { messages, notifyInBackground, summarize } from "../notifications";
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

const AddPhotoInput = builder.inputType("AddPhotoInput", {
  fields: (t) => ({
    interventionId: t.id({ required: true }),
    /** UUID généré par le mobile : rend la mutation idempotente. */
    clientId: t.string({ required: true }),
    fileId: t.id({ required: true }),
    caption: t.string(),
    takenAt: t.field({ type: "DateTime", required: true }),
  }),
});

const SignatureStrokeInput = builder.inputType("SignatureStrokeInput", {
  fields: (t) => ({
    /** Liste plate [x1, y1, x2, y2, …] dans le repère width × height. */
    points: t.floatList({ required: true }),
  }),
});

const SignInterventionInput = builder.inputType("SignInterventionInput", {
  fields: (t) => ({
    interventionId: t.id({ required: true }),
    signerName: t.string({ required: true }),
    signedAt: t.field({ type: "DateTime", required: true }),
    /** Dimensions de la zone de signature sur l'écran du mobile. */
    width: t.int({ required: true }),
    height: t.int({ required: true }),
    strokes: t.field({ type: [SignatureStrokeInput], required: true }),
  }),
});

/** Intervention assignée au technicien connecté (sinon : introuvable). */
async function ownIntervention(viewer: Viewer, id: string) {
  const intervention = await prisma.intervention.findFirst({
    where: { id, companyId: viewer.companyId, technicianId: viewer.id },
    select: { id: true, status: true, signature: { select: { id: true } } },
  });
  if (!intervention) throw notFound();
  return intervention;
}

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
        if (data.technicianId) {
          const technicianId = data.technicianId;
          void summarize(created.id).then((i) => notifyInBackground(technicianId, messages.assigned(i)));
        }
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

        // Prévenir les techniciens concernés : nouveau, ancien, ou le même si l'horaire a changé
        const before = existing.technicianId;
        const after = args.technicianId !== undefined ? (args.technicianId ? String(args.technicianId) : null) : before;
        const moved = existing.scheduledStart.getTime() !== args.scheduledStart.getTime();
        void summarize(existing.id).then((i) => {
          if (after !== before) {
            notifyInBackground(after, messages.assigned(i));
            notifyInBackground(before, messages.unassigned(i));
          } else if (moved) {
            notifyInBackground(after, messages.rescheduled(i));
          }
        });
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
          select: { id: true, status: true, technicianId: true, signature: { select: { id: true } } },
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
        if (input.status === "CANCELLED" && viewer.role === "MANAGER") {
          const technicianId = existing.technicianId;
          void summarize(id).then((i) => notifyInBackground(technicianId, messages.cancelled(i)));
        }
        return updated;
      },
    }),

    registerPushToken: t.boolean({
      description: "Enregistre l'appareil du technicien pour les notifications push (Expo).",
      args: { token: t.arg.string({ required: true }), platform: t.arg.string({ required: true }) },
      resolve: async (_root, args, ctx) => {
        const viewer = requireViewer(ctx);
        if (!/^Expo(nent)?PushToken\[[^\]]{10,}\]$/.test(args.token)) {
          throw new GraphQLError("Jeton de notification invalide", { extensions: { code: "BAD_USER_INPUT" } });
        }
        const platform = ["ios", "android"].includes(args.platform) ? args.platform : "unknown";
        // un appareil partagé passe au technicien connecté
        await prisma.pushToken.upsert({
          where: { token: args.token },
          create: { token: args.token, platform, userId: viewer.id },
          update: { userId: viewer.id, platform },
        });
        return true;
      },
    }),

    unregisterPushToken: t.boolean({
      description: "Désinscrit l'appareil (déconnexion).",
      args: { token: t.arg.string({ required: true }) },
      resolve: async (_root, args, ctx) => {
        const viewer = requireViewer(ctx);
        await prisma.pushToken.deleteMany({ where: { token: args.token, userId: viewer.id } });
        return true;
      },
    }),

    addPhoto: t.prismaField({
      type: "Photo",
      description: "Rattache une photo déjà envoyée (POST /api/files) à une intervention. Idempotent (clientId).",
      args: { input: t.arg({ type: AddPhotoInput, required: true }) },
      resolve: async (query, _root, { input }, ctx) => {
        const viewer = requireViewer(ctx, "TECHNICIAN");
        const replay = await prisma.photo.findUnique({ ...query, where: { clientId: input.clientId } });
        if (replay) return replay;

        const intervention = await ownIntervention(viewer, String(input.interventionId));
        if (intervention.status === "CANCELLED") {
          throw new GraphQLError("Intervention annulée", { extensions: { code: "INVALID_TRANSITION" } });
        }
        const file = await prisma.storedFile.findFirst({
          where: { id: String(input.fileId), companyId: viewer.companyId },
          select: { id: true },
        });
        if (!file) throw new GraphQLError("Fichier introuvable", { extensions: { code: "NOT_FOUND" } });

        const photo = await prisma.photo.create({
          ...query,
          data: {
            clientId: input.clientId,
            url: fileUrl(file.id),
            caption: input.caption ?? null,
            takenAt: input.takenAt,
            interventionId: intervention.id,
          },
        });
        pubsub.publish("intervention:updated", viewer.companyId, { interventionId: intervention.id });
        return photo;
      },
    }),

    signIntervention: t.prismaField({
      type: "Intervention",
      description:
        "Enregistre la signature du client (tracés). Le SVG est construit côté serveur. Rejouable sans effet de bord.",
      args: { input: t.arg({ type: SignInterventionInput, required: true }) },
      resolve: async (query, _root, { input }, ctx) => {
        const viewer = requireViewer(ctx, "TECHNICIAN");
        const intervention = await ownIntervention(viewer, String(input.interventionId));

        if (intervention.status === "DONE" && intervention.signature) {
          // rejeu après clôture : la signature est déjà enregistrée
          return prisma.intervention.findUniqueOrThrow({ ...query, where: { id: intervention.id } });
        }
        if (intervention.status !== "ON_SITE") {
          throw new GraphQLError("La signature se fait sur place", { extensions: { code: "INVALID_TRANSITION" } });
        }
        const parsed = signatureStrokesSchema.safeParse({
          width: input.width,
          height: input.height,
          strokes: input.strokes.map((s) => s.points),
        });
        const signerName = input.signerName.trim();
        if (!parsed.success || signerName.length < 2 || signerName.length > 80) {
          throw new GraphQLError("Signature invalide", { extensions: { code: "BAD_USER_INPUT" } });
        }

        const svg = new TextEncoder().encode(buildSignatureSvg(parsed.data));
        const fileClientId = `sig-${intervention.id}`;
        const file = await prisma.storedFile.upsert({
          where: { clientId: fileClientId },
          create: {
            clientId: fileClientId,
            companyId: viewer.companyId,
            contentType: "image/svg+xml",
            size: svg.byteLength,
            data: Buffer.from(svg),
          },
          update: { data: Buffer.from(svg), size: svg.byteLength },
          select: { id: true },
        });
        const data = { url: fileUrl(file.id), signerName, signedAt: input.signedAt };
        await prisma.signature.upsert({
          where: { interventionId: intervention.id },
          create: { ...data, interventionId: intervention.id },
          update: data,
        });
        pubsub.publish("intervention:updated", viewer.companyId, { interventionId: intervention.id });
        return prisma.intervention.findUniqueOrThrow({ ...query, where: { id: intervention.id } });
      },
    }),

    saveReport: t.prismaField({
      type: "Intervention",
      description: "Compte rendu du technicien (remplace le précédent).",
      args: { interventionId: t.arg.id({ required: true }), report: t.arg.string({ required: true }) },
      resolve: async (query, _root, args, ctx) => {
        const viewer = requireViewer(ctx, "TECHNICIAN");
        const intervention = await ownIntervention(viewer, String(args.interventionId));
        if (intervention.status === "CANCELLED") {
          throw new GraphQLError("Intervention annulée", { extensions: { code: "INVALID_TRANSITION" } });
        }
        const report = args.report.trim().slice(0, 4000) || null;
        const updated = await prisma.intervention.update({ ...query, where: { id: intervention.id }, data: { report } });
        pubsub.publish("intervention:updated", viewer.companyId, { interventionId: intervention.id });
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
