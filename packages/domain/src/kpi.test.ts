import { describe, expect, it } from "vitest";
import { arrivalDelayMinutes, average, firstTimeFixRate, onSiteDurationMinutes } from "./kpi";
import type { InterventionLike } from "./kpi";

const at = (hhmm: string) => new Date(`2026-10-14T${hhmm}:00Z`);

const done: InterventionLike = {
  status: "DONE",
  scheduledStart: at("09:00"),
  visitNumber: 1,
  events: [
    { status: "EN_ROUTE", at: at("08:40") },
    { status: "ON_SITE", at: at("09:10") },
    { status: "DONE", at: at("10:25") },
  ],
};

describe("KPI", () => {
  it("calcule la durée sur site", () => {
    expect(onSiteDurationMinutes(done)).toBe(75);
  });

  it("calcule le retard à l'arrivée", () => {
    expect(arrivalDelayMinutes(done)).toBe(10);
  });

  it("renvoie null quand l'intervention n'est pas terminée", () => {
    expect(onSiteDurationMinutes({ ...done, status: "ON_SITE", events: done.events.slice(0, 2) })).toBeNull();
  });

  it("calcule le taux de résolution à la première visite", () => {
    const second = { ...done, visitNumber: 2 };
    const planned = { ...done, status: "PLANNED" as const };
    expect(firstTimeFixRate([done, done, second, planned])).toBeCloseTo(2 / 3);
    expect(firstTimeFixRate([planned])).toBeNull();
  });

  it("fait une moyenne en ignorant les valeurs nulles", () => {
    expect(average([10, null, 20])).toBe(15);
    expect(average([null])).toBeNull();
  });
});
