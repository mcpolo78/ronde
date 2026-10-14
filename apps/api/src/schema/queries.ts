import { arrivalDelayMinutes, average, firstTimeFixRate, onSiteDurationMinutes } from "@ronde/domain";
import { builder, requireViewer } from "../builder";
import { prisma } from "../db";
import { InterventionStatusEnum } from "./enums";

const Dashboard = builder
  .objectRef<{
    total: number;
    done: number;
    inProgress: number;
    avgOnSiteMinutes: number | null;
    avgArrivalDelayMinutes: number | null;
    firstTimeFixRate: number | null;
  }>("Dashboard")
  .implement({
    description: "Indicateurs de la période, calculés à partir de l'historique des statuts.",
    fields: (t) => ({
      total: t.exposeInt("total"),
      done: t.exposeInt("done"),
      inProgress: t.exposeInt("inProgress"),
      avgOnSiteMinutes: t.exposeFloat("avgOnSiteMinutes", { nullable: true }),
      avgArrivalDelayMinutes: t.exposeFloat("avgArrivalDelayMinutes", { nullable: true }),
      firstTimeFixRate: t.exposeFloat("firstTimeFixRate", { nullable: true }),
    }),
  });

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

builder.queryType({
  fields: (t) => ({
    me: t.prismaField({
      type: "User",
      nullable: true,
      resolve: (query, _root, _args, ctx) =>
        ctx.viewer ? prisma.user.findUnique({ ...query, where: { id: ctx.viewer.id } }) : null,
    }),

    technicians: t.prismaField({
      type: ["User"],
      resolve: (query, _root, _args, ctx) => {
        const viewer = requireViewer(ctx, "MANAGER");
        return prisma.user.findMany({
          ...query,
          where: { companyId: viewer.companyId, role: "TECHNICIAN" },
          orderBy: { name: "asc" },
        });
      },
    }),

    interventions: t.prismaField({
      type: ["Intervention"],
      description: "Interventions de l'entreprise sur une période (vue planning et liste).",
      args: {
        from: t.arg({ type: "DateTime", required: true }),
        to: t.arg({ type: "DateTime", required: true }),
        status: t.arg({ type: [InterventionStatusEnum], required: false }),
        technicianId: t.arg.id({ required: false }),
      },
      resolve: (query, _root, args, ctx) => {
        const viewer = requireViewer(ctx, "MANAGER");
        return prisma.intervention.findMany({
          ...query,
          where: {
            companyId: viewer.companyId,
            scheduledStart: { gte: args.from, lt: args.to },
            ...(args.status?.length ? { status: { in: args.status } } : {}),
            ...(args.technicianId ? { technicianId: String(args.technicianId) } : {}),
          },
          orderBy: { scheduledStart: "asc" },
        });
      },
    }),

    intervention: t.prismaField({
      type: "Intervention",
      nullable: true,
      args: { id: t.arg.id({ required: true }) },
      resolve: (query, _root, args, ctx) => {
        const viewer = requireViewer(ctx);
        return prisma.intervention.findFirst({
          ...query,
          where: {
            id: String(args.id),
            companyId: viewer.companyId,
            // un technicien ne voit que ses propres interventions
            ...(viewer.role === "TECHNICIAN" ? { technicianId: viewer.id } : {}),
          },
        });
      },
    }),

    myDay: t.prismaField({
      type: ["Intervention"],
      description: "Interventions du technicien connecté pour une journée (préchargées pour le hors ligne).",
      args: { date: t.arg({ type: "DateTime", required: false }) },
      resolve: (query, _root, args, ctx) => {
        const viewer = requireViewer(ctx, "TECHNICIAN");
        const day = startOfDay(args.date ?? new Date());
        return prisma.intervention.findMany({
          ...query,
          where: {
            technicianId: viewer.id,
            scheduledStart: { gte: day, lt: addDays(day, 1) },
            status: { not: "CANCELLED" },
          },
          orderBy: { scheduledStart: "asc" },
        });
      },
    }),

    dashboard: t.field({
      type: Dashboard,
      args: {
        from: t.arg({ type: "DateTime", required: true }),
        to: t.arg({ type: "DateTime", required: true }),
      },
      resolve: async (_root, args, ctx) => {
        const viewer = requireViewer(ctx, "MANAGER");
        const rows = await prisma.intervention.findMany({
          where: { companyId: viewer.companyId, scheduledStart: { gte: args.from, lt: args.to } },
          select: {
            status: true,
            scheduledStart: true,
            visitNumber: true,
            events: { select: { status: true, at: true }, orderBy: { at: "asc" } },
          },
        });
        return {
          total: rows.length,
          done: rows.filter((r) => r.status === "DONE").length,
          inProgress: rows.filter((r) => r.status === "EN_ROUTE" || r.status === "ON_SITE").length,
          avgOnSiteMinutes: average(rows.map(onSiteDurationMinutes)),
          avgArrivalDelayMinutes: average(rows.map(arrivalDelayMinutes)),
          firstTimeFixRate: firstTimeFixRate(rows),
        };
      },
    }),
  }),
});
