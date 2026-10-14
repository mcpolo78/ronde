/**
 * Moteur de synchronisation hors ligne (voir docs/adr/0003-offline-first-mobile.md).
 *
 * - L'état affiché = dernier état connu du serveur + opérations en attente rejouées par-dessus
 *   (`view`). Après chaque synchronisation, on recharge l'état serveur et on rejoue ce qui reste :
 *   l'affichage ne « saute » jamais en arrière.
 * - Les opérations partent dans l'ordre, une par une (`processQueue`). Une erreur réseau arrête
 *   la file (on réessaiera) ; un refus métier du serveur retire l'opération et signale un conflit.
 * - Chaque opération porte un identifiant unique généré sur l'appareil : le serveur l'utilise
 *   pour ne l'appliquer qu'une fois, même si elle est envoyée plusieurs fois.
 *
 * Aucune dépendance à React Native : testé unitairement (engine.test.ts).
 */
import { canTransition, type InterventionStatus } from "@ronde/domain";
import type { DayIntervention } from "../lib/queries";

export type Op =
  | (OpBase & { kind: "status"; status: InterventionStatus; at: string })
  | (OpBase & { kind: "checklist"; itemId: string; checked: boolean })
  | (OpBase & { kind: "photo"; localUri: string; takenAt: string; caption?: string })
  | (OpBase & {
      kind: "signature";
      signerName: string;
      signedAt: string;
      width: number;
      height: number;
      strokes: number[][];
    })
  | (OpBase & { kind: "report"; report: string });

interface OpBase {
  /** UUID généré sur l'appareil, envoyé comme `clientId` (idempotence). */
  id: string;
  interventionId: string;
  createdAt: string;
}

/** Intervention telle qu'affichée : peut contenir des éléments pas encore synchronisés. */
export type LocalIntervention = Omit<DayIntervention, "photos" | "signature"> & {
  photos: (DayIntervention["photos"][number] & { pending?: boolean })[];
  signature: (Omit<NonNullable<DayIntervention["signature"]>, "url"> & { url: string | null; pending?: boolean }) | null;
};

/** Applique une opération en attente à la liste, de façon optimiste. */
export function applyOp(list: LocalIntervention[], op: Op): LocalIntervention[] {
  return list.map((i) => {
    if (i.id !== op.interventionId) return i;
    switch (op.kind) {
      case "status":
        return { ...i, status: op.status };
      case "checklist":
        return { ...i, checklist: i.checklist.map((c) => (c.id === op.itemId ? { ...c, checked: op.checked } : c)) };
      case "photo":
        return { ...i, photos: [...i.photos, { id: op.id, url: op.localUri, caption: op.caption ?? null, pending: true }] };
      case "signature":
        return { ...i, signature: { signerName: op.signerName, signedAt: op.signedAt, url: null, pending: true } };
      case "report":
        return { ...i, report: op.report };
    }
  });
}

export function view(server: LocalIntervention[], queue: Op[]): LocalIntervention[] {
  return queue.reduce(applyOp, server);
}

export function pendingCount(queue: Op[], interventionId?: string) {
  return interventionId ? queue.filter((o) => o.interventionId === interventionId).length : queue.length;
}

/**
 * Vérifie un changement de statut avant de le mettre en file, avec les mêmes règles que le serveur
 * (packages/domain). Le serveur revalide de toute façon à la synchronisation.
 */
export function checkStatusChange(intervention: LocalIntervention, to: InterventionStatus) {
  return canTransition(intervention.status, to, {
    role: "TECHNICIAN",
    hasSignature: Boolean(intervention.signature),
  });
}

export type SendResult = { ok: true } | { ok: false; retry: true } | { ok: false; retry: false; code?: string; message: string };

export interface ProcessResult {
  remaining: Op[];
  sent: Op[];
  rejected: { op: Op; code?: string; message: string }[];
  /** La file s'est arrêtée sur une erreur réseau. */
  interrupted: boolean;
}

export async function processQueue(queue: Op[], send: (op: Op) => Promise<SendResult>): Promise<ProcessResult> {
  const sent: Op[] = [];
  const rejected: ProcessResult["rejected"] = [];
  for (let index = 0; index < queue.length; index++) {
    const op = queue[index]!;
    const result = await send(op);
    if (result.ok) {
      sent.push(op);
    } else if (result.retry) {
      return { remaining: queue.slice(index), sent, rejected, interrupted: true };
    } else {
      rejected.push({ op, code: result.code, message: result.message });
    }
  }
  return { remaining: [], sent, rejected, interrupted: false };
}

const CONFLICT_MESSAGES: Record<string, string> = {
  INVALID_TRANSITION: "L'intervention a été modifiée par le planning (annulée ou replanifiée) : votre action n'a pas été prise en compte.",
  NOT_FOUND: "Cette intervention ne vous est plus assignée.",
  MISSING_SIGNATURE: "La signature du client est nécessaire pour clôturer.",
};

export function conflictMessage(code: string | undefined, fallback: string) {
  return CONFLICT_MESSAGES[code ?? ""] ?? fallback;
}
