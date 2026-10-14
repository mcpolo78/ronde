/**
 * Cycle de vie d'une intervention.
 * Source de vérité unique : utilisée par l'API (validation serveur)
 * et par l'app mobile (mise à jour optimiste hors ligne).
 */
export const INTERVENTION_STATUSES = [
  "PLANNED",
  "EN_ROUTE",
  "ON_SITE",
  "DONE",
  "CANCELLED",
] as const;

export type InterventionStatus = (typeof INTERVENTION_STATUSES)[number];

export type Role = "MANAGER" | "TECHNICIAN";

const TRANSITIONS: Record<InterventionStatus, readonly InterventionStatus[]> = {
  PLANNED: ["EN_ROUTE", "CANCELLED"],
  EN_ROUTE: ["ON_SITE", "PLANNED", "CANCELLED"],
  ON_SITE: ["DONE", "CANCELLED"],
  DONE: [],
  CANCELLED: [],
};

/** Seul un manager peut annuler ou replanifier ; le technicien fait avancer l'intervention. */
const ALLOWED_BY_ROLE: Record<Role, readonly InterventionStatus[]> = {
  MANAGER: ["PLANNED", "CANCELLED"],
  TECHNICIAN: ["EN_ROUTE", "ON_SITE", "DONE"],
};

export function isTerminal(status: InterventionStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

export function nextStatuses(from: InterventionStatus, role: Role): InterventionStatus[] {
  return TRANSITIONS[from].filter((to) => ALLOWED_BY_ROLE[role].includes(to));
}

export type TransitionCheck =
  | { ok: true }
  | { ok: false; reason: "INVALID_TRANSITION" | "FORBIDDEN_FOR_ROLE" | "MISSING_SIGNATURE" };

export interface TransitionContext {
  role: Role;
  /** Une intervention ne peut être clôturée qu'avec la signature du client. */
  hasSignature?: boolean;
}

export function canTransition(
  from: InterventionStatus,
  to: InterventionStatus,
  ctx: TransitionContext,
): TransitionCheck {
  if (!TRANSITIONS[from].includes(to)) return { ok: false, reason: "INVALID_TRANSITION" };
  if (!ALLOWED_BY_ROLE[ctx.role].includes(to)) return { ok: false, reason: "FORBIDDEN_FOR_ROLE" };
  if (to === "DONE" && !ctx.hasSignature) return { ok: false, reason: "MISSING_SIGNATURE" };
  return { ok: true };
}

export const STATUS_LABELS: Record<InterventionStatus, string> = {
  PLANNED: "Planifiée",
  EN_ROUTE: "En route",
  ON_SITE: "Sur place",
  DONE: "Terminée",
  CANCELLED: "Annulée",
};
