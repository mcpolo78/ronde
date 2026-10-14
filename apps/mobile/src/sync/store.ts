import AsyncStorage from "@react-native-async-storage/async-storage";
import type { InterventionStatus } from "@ronde/domain";
import { randomUUID } from "expo-crypto";
import { useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ApiError, gql, NetworkError } from "../lib/api";
import { MyDayQuery } from "../lib/queries";
import { checkStatusChange, conflictMessage, processQueue, view, type LocalIntervention, type Op } from "./engine";
import { preparePhoto } from "./photos";
import { send } from "./transport";

type NewOp = Op extends infer O ? (O extends Op ? Omit<O, "id" | "createdAt"> : never) : never;

interface SyncState {
  /** Dernier état connu du serveur (persisté : consultable sans réseau). */
  server: LocalIntervention[];
  technicianId: string | null;
  technicianName: string | null;
  fetchedAt: string | null;
  /** Opérations faites sur l'appareil, pas encore confirmées par le serveur (persisté). */
  queue: Op[];
  /** Opérations refusées par le serveur, par intervention : affichées en bandeau. */
  conflicts: Record<string, string>;
  syncing: boolean;
  /** Dernier contact réussi avec le serveur ? */
  reachable: boolean;

  refresh(): Promise<void>;
  sync(): Promise<void>;
  enqueue(op: NewOp): void;
  changeStatus(interventionId: string, status: InterventionStatus): { ok: true } | { ok: false; reason: string };
  addPhoto(interventionId: string, sourceUri: string): Promise<void>;
  dismissConflict(interventionId: string): void;
  reset(): void;
}

const initial = {
  server: [] as LocalIntervention[],
  technicianId: null,
  technicianName: null,
  fetchedAt: null,
  queue: [] as Op[],
  conflicts: {},
  syncing: false,
  reachable: true,
};

export const useSync = create<SyncState>()(
  persist(
    (set, get) => ({
      ...initial,

      async refresh() {
        try {
          const { me, myDay } = await gql(MyDayQuery);
          set({ server: myDay, technicianId: me?.id ?? null, technicianName: me?.name ?? null, fetchedAt: new Date().toISOString(), reachable: true });
        } catch (error) {
          if (error instanceof NetworkError) set({ reachable: false });
          else if (!(error instanceof ApiError)) throw error;
        }
      },

      async sync() {
        if (get().syncing) return;
        set({ syncing: true });
        try {
          const queue = get().queue;
          if (queue.length) {
            const result = await processQueue(queue, send);
            // des opérations ont pu être ajoutées pendant l'envoi : on ne retire que celles traitées
            const handled = new Set([...result.sent, ...result.rejected.map((r) => r.op)].map((o) => o.id));
            const conflicts = { ...get().conflicts };
            for (const { op, code, message } of result.rejected) conflicts[op.interventionId] = conflictMessage(code, message);
            set({ queue: get().queue.filter((o) => !handled.has(o.id)), conflicts, reachable: !result.interrupted });
            if (result.interrupted) return;
          }
          await get().refresh();
        } finally {
          set({ syncing: false });
        }
      },

      enqueue(op) {
        const full = { ...op, id: randomUUID(), createdAt: new Date().toISOString() } as Op;
        set({ queue: [...get().queue, full] });
        void get().sync();
      },

      changeStatus(interventionId, status) {
        const intervention = view(get().server, get().queue).find((i) => i.id === interventionId);
        if (!intervention) return { ok: false, reason: "NOT_FOUND" };
        const check = checkStatusChange(intervention, status);
        if (!check.ok) return { ok: false, reason: check.reason };
        get().enqueue({ kind: "status", interventionId, status, at: new Date().toISOString() });
        return { ok: true };
      },

      async addPhoto(interventionId, sourceUri) {
        const id = randomUUID();
        const localUri = await preparePhoto(sourceUri, id);
        const full: Op = { kind: "photo", id, interventionId, localUri, takenAt: new Date().toISOString(), createdAt: new Date().toISOString() };
        set({ queue: [...get().queue, full] });
        void get().sync();
      },

      dismissConflict(interventionId) {
        const { [interventionId]: _, ...rest } = get().conflicts;
        set({ conflicts: rest });
      },

      reset() {
        set(initial);
      },
    }),
    {
      name: "ronde-sync",
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ server, technicianId, technicianName, fetchedAt, queue, conflicts }) => ({
        server,
        technicianId,
        technicianName,
        fetchedAt,
        queue,
        conflicts,
      }),
    },
  ),
);

/** Interventions affichées : état serveur + opérations en attente. */
export function useDay() {
  const server = useSync((s) => s.server);
  const queue = useSync((s) => s.queue);
  return useMemo(() => view(server, queue), [server, queue]);
}
