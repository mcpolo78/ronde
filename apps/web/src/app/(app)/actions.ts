"use server";

import { createInterventionSchema, zonedDateTime } from "@ronde/domain";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError, gql } from "@/lib/api";
import {
  ChangeStatusMutation,
  CreateInterventionMutation,
  ScheduleInterventionMutation,
} from "@/lib/queries";

// L'autorisation n'est pas faite ici : chaque mutation est revérifiée par l'API
// (session, rôle, entreprise, règles de transition).

export type ActionResult = { ok: true } | { ok: false; message: string };

const MESSAGES: Record<string, string> = {
  CONFLICT: "Cette intervention est clôturée : elle ne peut plus être déplacée.",
  INVALID_TRANSITION: "Ce changement de statut n'est plus possible.",
  FORBIDDEN: "Action non autorisée.",
  NOT_FOUND: "Intervention introuvable.",
};

function toResult(error: unknown): ActionResult {
  if (error instanceof ApiError) {
    return { ok: false, message: MESSAGES[error.code ?? ""] ?? error.message };
  }
  throw error; // redirections Next.js et erreurs inattendues
}

export async function scheduleIntervention(input: {
  id: string;
  scheduledStart: string;
  scheduledEnd: string;
  technicianId: string | null;
}): Promise<ActionResult> {
  try {
    await gql(ScheduleInterventionMutation, input);
  } catch (error) {
    return toResult(error);
  }
  refresh();
  return { ok: true };
}

export async function cancelIntervention(id: string): Promise<ActionResult> {
  try {
    await gql(ChangeStatusMutation, {
      input: {
        interventionId: id,
        status: "CANCELLED",
        at: new Date().toISOString(),
        clientId: crypto.randomUUID(),
      },
    });
  } catch (error) {
    return toResult(error);
  }
  refresh();
  return { ok: true };
}

export interface CreateFormState {
  values?: Record<string, string>;
  fieldErrors?: Partial<Record<string, string>>;
  formError?: string;
}

export async function createIntervention(
  _previous: CreateFormState,
  formData: FormData,
): Promise<CreateFormState> {
  const values = Object.fromEntries(
    [...formData.entries()].map(([k, v]) => [k, typeof v === "string" ? v.trim() : ""]),
  );

  const fieldErrors: Partial<Record<string, string>> = {};
  let scheduledStart: Date | undefined;
  let scheduledEnd: Date | undefined;
  try {
    scheduledStart = zonedDateTime(values.day ?? "", values.startTime ?? "");
    scheduledEnd = zonedDateTime(values.day ?? "", values.endTime ?? "");
  } catch {
    fieldErrors.day = "Indiquez une date et des horaires valides.";
  }

  // Mêmes règles de validation que l'API (packages/domain)
  const parsed = createInterventionSchema.safeParse({
    siteId: values.siteId,
    type: values.type,
    description: values.description || undefined,
    priority: values.priority || undefined,
    scheduledStart,
    scheduledEnd,
    technicianId: values.technicianId || undefined,
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      const field = key === "scheduledEnd" || key === "scheduledStart" ? "endTime" : key;
      fieldErrors[field] ??= FIELD_MESSAGES[field] ?? issue.message;
    }
  }
  if (Object.keys(fieldErrors).length || !parsed.success) return { values, fieldErrors };

  let id: string;
  try {
    const { createIntervention } = await gql(CreateInterventionMutation, {
      input: {
        ...parsed.data,
        scheduledStart: parsed.data.scheduledStart.toISOString(),
        scheduledEnd: parsed.data.scheduledEnd.toISOString(),
      },
    });
    id = createIntervention.id;
  } catch (error) {
    if (error instanceof ApiError) return { values, formError: error.message };
    throw error;
  }
  redirect(`/interventions/${id}?created=1`);
}

const FIELD_MESSAGES: Record<string, string> = {
  siteId: "Choisissez un site.",
  type: "Indiquez le type d'intervention.",
  endTime: "L'heure de fin doit être après l'heure de début.",
};
