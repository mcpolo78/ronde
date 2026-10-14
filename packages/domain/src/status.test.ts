import { describe, expect, it } from "vitest";
import { canTransition, isTerminal, nextStatuses } from "./status";

describe("canTransition", () => {
  it("laisse le technicien faire avancer une intervention", () => {
    expect(canTransition("PLANNED", "EN_ROUTE", { role: "TECHNICIAN" })).toEqual({ ok: true });
    expect(canTransition("EN_ROUTE", "ON_SITE", { role: "TECHNICIAN" })).toEqual({ ok: true });
  });

  it("refuse de sauter une étape", () => {
    expect(canTransition("PLANNED", "DONE", { role: "TECHNICIAN", hasSignature: true })).toEqual({
      ok: false,
      reason: "INVALID_TRANSITION",
    });
  });

  it("exige la signature du client pour clôturer", () => {
    expect(canTransition("ON_SITE", "DONE", { role: "TECHNICIAN" })).toEqual({
      ok: false,
      reason: "MISSING_SIGNATURE",
    });
    expect(canTransition("ON_SITE", "DONE", { role: "TECHNICIAN", hasSignature: true })).toEqual({
      ok: true,
    });
  });

  it("réserve l'annulation au manager", () => {
    expect(canTransition("PLANNED", "CANCELLED", { role: "TECHNICIAN" })).toEqual({
      ok: false,
      reason: "FORBIDDEN_FOR_ROLE",
    });
    expect(canTransition("PLANNED", "CANCELLED", { role: "MANAGER" })).toEqual({ ok: true });
  });

  it("ne permet rien après un état terminal", () => {
    expect(isTerminal("DONE")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
    expect(canTransition("DONE", "PLANNED", { role: "MANAGER" }).ok).toBe(false);
  });
});

describe("nextStatuses", () => {
  it("filtre selon le rôle", () => {
    expect(nextStatuses("EN_ROUTE", "TECHNICIAN")).toEqual(["ON_SITE"]);
    expect(nextStatuses("EN_ROUTE", "MANAGER")).toEqual(["PLANNED", "CANCELLED"]);
  });
});
