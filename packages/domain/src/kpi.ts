import type { InterventionStatus } from "./status";

export interface StatusEventLike {
  status: InterventionStatus;
  at: Date;
}

export interface InterventionLike {
  status: InterventionStatus;
  scheduledStart: Date;
  events: StatusEventLike[];
  /** Nombre de visites nécessaires pour résoudre le problème du client. */
  visitNumber: number;
}

/** Durée sur site en minutes (ON_SITE → DONE), ou null si l'intervention n'est pas terminée. */
export function onSiteDurationMinutes(intervention: InterventionLike): number | null {
  const arrived = intervention.events.find((e) => e.status === "ON_SITE");
  const done = intervention.events.find((e) => e.status === "DONE");
  if (!arrived || !done) return null;
  return Math.round((done.at.getTime() - arrived.at.getTime()) / 60_000);
}

/** Retard à l'arrivée en minutes par rapport au créneau prévu (négatif = en avance). */
export function arrivalDelayMinutes(intervention: InterventionLike): number | null {
  const arrived = intervention.events.find((e) => e.status === "ON_SITE");
  if (!arrived) return null;
  return Math.round((arrived.at.getTime() - intervention.scheduledStart.getTime()) / 60_000);
}

/** Part des interventions terminées résolues dès la première visite (0 → 1). */
export function firstTimeFixRate(interventions: InterventionLike[]): number | null {
  const done = interventions.filter((i) => i.status === "DONE");
  if (done.length === 0) return null;
  return done.filter((i) => i.visitNumber === 1).length / done.length;
}

export function average(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
