import { describe, expect, it, vi } from "vitest";
import { applyOp, checkStatusChange, processQueue, view, type LocalIntervention, type Op, type SendResult } from "./engine";

const intervention = (over: Partial<LocalIntervention> = {}): LocalIntervention => ({
  id: "i1",
  reference: "INT-2026-0001",
  type: "Entretien chaudière gaz",
  description: null,
  status: "PLANNED",
  priority: "NORMAL",
  scheduledStart: "2026-10-14T07:00:00.000Z",
  scheduledEnd: "2026-10-14T08:00:00.000Z",
  visitNumber: 1,
  report: null,
  site: {
    id: "s1",
    label: "Domicile",
    address: "1 rue de la Paix",
    postalCode: "75002",
    city: "Paris",
    latitude: 48.86,
    longitude: 2.33,
    accessNotes: null,
    customer: { id: "c1", name: "Mme Durand", phone: null },
  },
  checklist: [{ id: "k1", label: "Contrôle combustion", checked: false }],
  photos: [],
  signature: null,
  ...over,
});

let n = 0;
const op = <K extends Op["kind"]>(kind: K, fields: Omit<Extract<Op, { kind: K }>, "kind" | "id" | "interventionId" | "createdAt">) =>
  ({ kind, id: `op-${++n}`, interventionId: "i1", createdAt: new Date().toISOString(), ...fields }) as Extract<Op, { kind: K }>;

describe("view : état serveur + opérations en attente", () => {
  it("rejoue les opérations dans l'ordre par-dessus l'état serveur", () => {
    const queue: Op[] = [
      op("status", { status: "EN_ROUTE", at: "t1" }),
      op("status", { status: "ON_SITE", at: "t2" }),
      op("checklist", { itemId: "k1", checked: true }),
      op("photo", { localUri: "file:///photo.jpg", takenAt: "t3" }),
      op("signature", { signerName: "Mme Durand", signedAt: "t4", width: 300, height: 120, strokes: [[1, 2, 3, 4]] }),
      op("report", { report: "RAS" }),
    ];
    const [result] = view([intervention()], queue);
    expect(result!.status).toBe("ON_SITE");
    expect(result!.checklist[0]!.checked).toBe(true);
    expect(result!.photos).toEqual([expect.objectContaining({ url: "file:///photo.jpg", pending: true })]);
    expect(result!.signature).toEqual(expect.objectContaining({ signerName: "Mme Durand", pending: true }));
    expect(result!.report).toBe("RAS");
  });

  it("ne touche pas aux autres interventions et ne modifie pas l'état serveur", () => {
    const server = [intervention(), intervention({ id: "i2" })];
    const result = applyOp(server, op("status", { status: "EN_ROUTE", at: "t" }));
    expect(result[1]).toBe(server[1]);
    expect(server[0]!.status).toBe("PLANNED");
  });
});

describe("checkStatusChange : mêmes règles que le serveur", () => {
  it("exige la signature pour clôturer, y compris une signature encore en attente", () => {
    const onSite = intervention({ status: "ON_SITE" });
    expect(checkStatusChange(onSite, "DONE")).toEqual({ ok: false, reason: "MISSING_SIGNATURE" });
    const signed = view([onSite], [op("signature", { signerName: "X", signedAt: "t", width: 300, height: 120, strokes: [[1, 1]] })])[0]!;
    expect(checkStatusChange(signed, "DONE")).toEqual({ ok: true });
  });

  it("interdit l'annulation au technicien", () => {
    expect(checkStatusChange(intervention(), "CANCELLED").ok).toBe(false);
  });
});

describe("processQueue", () => {
  const queue = () => [
    op("status", { status: "EN_ROUTE", at: "t1" }),
    op("status", { status: "ON_SITE", at: "t2" }),
    op("report", { report: "RAS" }),
  ];

  it("envoie toute la file dans l'ordre", async () => {
    const q = queue();
    const send = vi.fn(async (_op: Op): Promise<SendResult> => ({ ok: true }));
    const result = await processQueue(q, send);
    expect(send.mock.calls.map(([o]) => o.id)).toEqual(q.map((o) => o.id));
    expect(result).toMatchObject({ remaining: [], interrupted: false });
  });

  it("s'arrête à la première erreur réseau et garde le reste pour plus tard", async () => {
    const q = queue();
    const send = vi.fn(async (o: Op): Promise<SendResult> => (o === q[1] ? { ok: false, retry: true } : { ok: true }));
    const result = await processQueue(q, send);
    expect(result.sent).toEqual([q[0]]);
    expect(result.remaining).toEqual([q[1], q[2]]);
    expect(result.interrupted).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("retire une opération refusée par le serveur et continue", async () => {
    const q = queue();
    const send = vi.fn(async (o: Op): Promise<SendResult> =>
      o === q[0] ? { ok: false, retry: false, code: "INVALID_TRANSITION", message: "refus" } : { ok: true },
    );
    const result = await processQueue(q, send);
    expect(result.rejected).toEqual([{ op: q[0], code: "INVALID_TRANSITION", message: "refus" }]);
    expect(result.sent).toEqual([q[1], q[2]]);
    expect(result.remaining).toEqual([]);
  });

  it("un rejeu après coupure renvoie les mêmes identifiants (idempotence côté serveur)", async () => {
    const q = queue();
    const ids: string[] = [];
    let offline = true;
    const send = async (o: Op): Promise<SendResult> => {
      ids.push(o.id);
      return offline && o === q[1] ? { ok: false, retry: true } : { ok: true };
    };
    const first = await processQueue(q, send);
    offline = false;
    await processQueue(first.remaining, send);
    expect(ids).toEqual([q[0]!.id, q[1]!.id, q[1]!.id, q[2]!.id]);
  });
});
