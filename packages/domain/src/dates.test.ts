import { describe, expect, it } from "vitest";
import { dayKey, dayRange, moveToDay, weekRange, workDaysOfWeek, zonedDateTime } from "./dates";

describe("dates (fuseau Europe/Paris)", () => {
  it("calcule la journée parisienne, même tard le soir en UTC", () => {
    // 22 h 30 UTC le 14 octobre = 00 h 30 à Paris le 15 octobre (UTC+2)
    const { from, to } = dayRange(new Date("2026-10-14T22:30:00Z"));
    expect(from.toISOString()).toBe("2026-10-14T22:00:00.000Z");
    expect(to.toISOString()).toBe("2026-10-15T22:00:00.000Z");
  });

  it("gère le passage à l'heure d'hiver (journée de 25 h)", () => {
    const { from, to } = dayRange("2026-10-25T12:00:00Z");
    expect(from.toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(to.toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });

  it("démarre la semaine le lundi", () => {
    const { from } = weekRange("2026-10-14T10:00:00Z"); // mercredi
    expect(dayKey(from)).toBe("2026-10-12");
    expect(workDaysOfWeek("2026-10-14T10:00:00Z").map(dayKey)).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
    ]);
  });

  it("convertit une saisie date + heure parisienne en instant", () => {
    expect(zonedDateTime("2026-10-14", "09:30").toISOString()).toBe("2026-10-14T07:30:00.000Z");
    expect(zonedDateTime("2026-12-01", "09:30").toISOString()).toBe("2026-12-01T08:30:00.000Z");
    expect(() => zonedDateTime("2026-10-14", "")).toThrow(RangeError);
  });

  it("déplace un créneau en gardant l'heure locale et la durée", () => {
    // 9 h → 10 h 30 à Paris le mercredi, déplacé au lundi suivant (heure d'hiver)
    const { from, to } = moveToDay(
      new Date("2026-10-21T07:00:00Z"),
      new Date("2026-10-21T08:30:00Z"),
      "2026-10-26",
    );
    expect(from.toISOString()).toBe("2026-10-26T08:00:00.000Z"); // toujours 9 h à Paris
    expect(to.getTime() - from.getTime()).toBe(90 * 60_000);
  });
});
