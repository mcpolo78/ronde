import { COMPANY_TIME_ZONE } from "@ronde/domain";

// Formatage toujours dans le fuseau de l'entreprise : le serveur de production est en UTC.
const fmt = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: COMPANY_TIME_ZONE, ...options });

const time = fmt({ hour: "2-digit", minute: "2-digit" });
const shortDay = fmt({ weekday: "short", day: "numeric", month: "short" });
const longDay = fmt({ weekday: "long", day: "numeric", month: "long" });
const dateTime = fmt({ day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const toDate = (value: Date | string) => (typeof value === "string" ? new Date(value) : value);

export const formatTime = (value: Date | string) => time.format(toDate(value));
export const formatShortDay = (value: Date | string) => shortDay.format(toDate(value));
export const formatLongDay = (value: Date | string) => longDay.format(toDate(value));
export const formatDateTime = (value: Date | string) => dateTime.format(toDate(value));

export function formatTimeRange(start: Date | string, end: Date | string) {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export function formatMinutes(minutes: number | null | undefined) {
  if (minutes == null) return "—";
  const rounded = Math.round(minutes);
  if (Math.abs(rounded) < 60) return `${rounded} min`;
  const h = Math.trunc(rounded / 60);
  const m = Math.abs(rounded % 60);
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export function formatPercent(ratio: number | null | undefined) {
  if (ratio == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 }).format(ratio);
}
