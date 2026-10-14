import { formatLongDay, formatTime } from "@ronde/domain";
import { prisma } from "./db";

/**
 * Notifications push vers l'app technicien (service Expo Push, gratuit, sans clé côté serveur).
 * L'envoi ne bloque jamais l'action du bureau : en cas d'échec, l'intervention apparaîtra
 * de toute façon à la prochaine synchronisation de l'app.
 */

export const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface PushMessage {
  title: string;
  body: string;
  data: { interventionId: string };
}

interface InterventionSummary {
  id: string;
  type: string;
  scheduledStart: Date;
  customerName: string;
}

const when = (date: Date) => `${formatLongDay(date)} à ${formatTime(date)}`;

export const messages = {
  assigned: (i: InterventionSummary): PushMessage => ({
    title: "Nouvelle intervention",
    body: `${i.type} — ${when(i.scheduledStart)} chez ${i.customerName}`,
    data: { interventionId: i.id },
  }),
  rescheduled: (i: InterventionSummary): PushMessage => ({
    title: "Intervention replanifiée",
    body: `${i.type} chez ${i.customerName} : ${when(i.scheduledStart)}`,
    data: { interventionId: i.id },
  }),
  unassigned: (i: InterventionSummary): PushMessage => ({
    title: "Intervention retirée de votre planning",
    body: `${i.type} chez ${i.customerName} (${when(i.scheduledStart)})`,
    data: { interventionId: i.id },
  }),
  cancelled: (i: InterventionSummary): PushMessage => ({
    title: "Intervention annulée",
    body: `${i.type} chez ${i.customerName} (${when(i.scheduledStart)}) a été annulée par le bureau`,
    data: { interventionId: i.id },
  }),
};

type Fetch = typeof fetch;

/** Envoie un message à tous les appareils d'un utilisateur ; retire les jetons devenus invalides. */
export async function notifyUser(userId: string, message: PushMessage, fetchImpl: Fetch = fetch) {
  const tokens = await prisma.pushToken.findMany({ where: { userId }, select: { token: true } });
  if (!tokens.length) return { sent: 0 };

  const response = await fetchImpl(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(
      tokens.map(({ token }) => ({ to: token, sound: "default", priority: "high", channelId: "interventions", ...message })),
    ),
  });
  const body = (await response.json()) as { data?: { status: string; details?: { error?: string } }[] };

  const invalid = tokens.filter((_, i) => body.data?.[i]?.details?.error === "DeviceNotRegistered").map((t) => t.token);
  if (invalid.length) await prisma.pushToken.deleteMany({ where: { token: { in: invalid } } });
  return { sent: tokens.length - invalid.length };
}

/** Variante « fire and forget » utilisée par les mutations. */
export function notifyInBackground(userId: string | null | undefined, message: PushMessage) {
  if (!userId || process.env.PUSH_NOTIFICATIONS === "off") return;
  notifyUser(userId, message).catch((error) => console.warn("Notification push non envoyée :", error));
}

/** Résumé d'une intervention pour composer les messages. */
export async function summarize(interventionId: string): Promise<InterventionSummary> {
  const i = await prisma.intervention.findUniqueOrThrow({
    where: { id: interventionId },
    select: { id: true, type: true, scheduledStart: true, site: { select: { customer: { select: { name: true } } } } },
  });
  return { id: i.id, type: i.type, scheduledStart: i.scheduledStart, customerName: i.site.customer.name };
}
