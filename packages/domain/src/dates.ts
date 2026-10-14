import { TZDate } from "@date-fns/tz";
import { addDays, addWeeks, format, parseISO, startOfDay, startOfWeek } from "date-fns";

/**
 * Toutes les notions calendaires (« aujourd'hui », « cette semaine ») sont exprimées
 * dans le fuseau de l'entreprise, pas dans celui du serveur : en production l'API et
 * le web tournent en UTC, et 23 h 30 à Paris est déjà le lendemain en UTC… ou l'inverse.
 */
export const COMPANY_TIME_ZONE = "Europe/Paris";

export interface DateRange {
  from: Date;
  to: Date;
}

const inZone = (date: Date | string) =>
  new TZDate(typeof date === "string" ? parseISO(date) : date, COMPANY_TIME_ZONE);

/** Journée [00:00, 00:00 du lendemain[ contenant `date`, à Paris. */
export function dayRange(date: Date | string = new Date()): DateRange {
  const from = startOfDay(inZone(date));
  return { from: new Date(from), to: new Date(addDays(from, 1)) };
}

/** Semaine du lundi au lundi suivant contenant `date`, à Paris. */
export function weekRange(date: Date | string = new Date()): DateRange {
  const from = startOfWeek(inZone(date), { weekStartsOn: 1 });
  return { from: new Date(from), to: new Date(addWeeks(from, 1)) };
}

/** Les 5 jours ouvrés (lundi → vendredi) de la semaine contenant `date`. */
export function workDaysOfWeek(date: Date | string = new Date()): Date[] {
  const monday = startOfWeek(inZone(date), { weekStartsOn: 1 });
  return [0, 1, 2, 3, 4].map((n) => new Date(addDays(monday, n)));
}

/** Clé de jour `yyyy-MM-dd` à Paris : sert à regrouper et à construire les URL. */
export function dayKey(date: Date | string): string {
  return format(inZone(date), "yyyy-MM-dd");
}

/** Instant correspondant à un jour (`yyyy-MM-dd`) et une heure (`HH:mm`) à Paris (formulaires). */
export function zonedDateTime(day: string, time: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if ([y, m, d, hh, mm].some((n) => n === undefined || Number.isNaN(n))) {
    throw new RangeError(`Date ou heure invalide : ${day} ${time}`);
  }
  return new Date(new TZDate(y!, m! - 1, d!, hh!, mm!, COMPANY_TIME_ZONE));
}

/**
 * Déplace un créneau vers un autre jour en conservant l'heure locale et la durée
 * (glisser-déposer du planning).
 */
export function moveToDay(start: Date, end: Date, targetDay: Date | string): DateRange {
  const s = inZone(start);
  const target = startOfDay(inZone(targetDay));
  const from = new TZDate(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
    s.getHours(),
    s.getMinutes(),
    COMPANY_TIME_ZONE,
  );
  return { from: new Date(from), to: new Date(from.getTime() + (end.getTime() - start.getTime())) };
}
