import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  pushToken: { findMany: vi.fn(), deleteMany: vi.fn() },
}));
vi.mock("./db", () => ({ prisma: prismaMock }));

const { EXPO_PUSH_URL, messages, notifyUser } = await import("./notifications");

const intervention = {
  id: "i1",
  type: "Entretien chaudière gaz",
  scheduledStart: new Date("2026-10-15T07:30:00Z"), // 9 h 30 à Paris
  customerName: "Mme Durand",
};

describe("messages", () => {
  it("décrit l'intervention en heure de Paris", () => {
    expect(messages.assigned(intervention)).toEqual({
      title: "Nouvelle intervention",
      body: "Entretien chaudière gaz — jeudi 15 octobre à 09:30 chez Mme Durand",
      data: { interventionId: "i1" },
    });
    expect(messages.cancelled(intervention).body).toContain("annulée par le bureau");
  });
});

describe("notifyUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("n'appelle pas le service quand l'utilisateur n'a aucun appareil", async () => {
    prismaMock.pushToken.findMany.mockResolvedValue([]);
    const fetchMock = vi.fn();
    expect(await notifyUser("u1", messages.assigned(intervention), fetchMock)).toEqual({ sent: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envoie à chaque appareil et retire les jetons invalides", async () => {
    prismaMock.pushToken.findMany.mockResolvedValue([{ token: "ExponentPushToken[a]" }, { token: "ExponentPushToken[b]" }]);
    const fetchMock = vi.fn(async () =>
      Response.json({ data: [{ status: "ok" }, { status: "error", details: { error: "DeviceNotRegistered" } }] }),
    );

    const result = await notifyUser("u1", messages.rescheduled(intervention), fetchMock as unknown as typeof fetch);

    expect(fetchMock).toHaveBeenCalledWith(EXPO_PUSH_URL, expect.objectContaining({ method: "POST" }));
    const sent = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent).toEqual([
      expect.objectContaining({ to: "ExponentPushToken[a]", title: "Intervention replanifiée", data: { interventionId: "i1" } }),
      expect.objectContaining({ to: "ExponentPushToken[b]" }),
    ]);
    expect(prismaMock.pushToken.deleteMany).toHaveBeenCalledWith({ where: { token: { in: ["ExponentPushToken[b]"] } } });
    expect(result).toEqual({ sent: 1 });
  });
});
