import { z } from "zod";
import { INTERVENTION_STATUSES } from "./status";

export const interventionStatusSchema = z.enum(INTERVENTION_STATUSES);

export const prioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);
export type Priority = z.infer<typeof prioritySchema>;

export const createInterventionSchema = z
  .object({
    siteId: z.string().min(1),
    type: z.string().min(2).max(80),
    description: z.string().max(2000).optional(),
    priority: prioritySchema.default("NORMAL"),
    scheduledStart: z.coerce.date(),
    scheduledEnd: z.coerce.date(),
    technicianId: z.string().min(1).optional(),
  })
  .refine((v) => v.scheduledEnd > v.scheduledStart, {
    message: "La fin du créneau doit être après le début",
    path: ["scheduledEnd"],
  });

export type CreateInterventionInput = z.infer<typeof createInterventionSchema>;
