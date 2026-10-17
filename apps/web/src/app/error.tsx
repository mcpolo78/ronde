"use client";

import { useEffect } from "react";

/** Intervalle entre deux vérifications de l'API. */
const POLL_MS = 4_000;
/** Intervalle plus long si la page a déjà été rechargée plusieurs fois en une minute. */
const SLOW_POLL_MS = 15_000;
const RELOADS_KEY = "ronde:reloads";

/** Rechargements de la dernière minute (mémorisés le temps de l'onglet). */
function recentReloads(): number[] {
  try {
    const now = Date.now();
    const stored = JSON.parse(sessionStorage.getItem(RELOADS_KEY) ?? "[]") as number[];
    return stored.filter((time) => now - time < 60_000);
  } catch {
    return [];
  }
}

/**
 * Affiché quand une page n'a pas pu charger ses données (API en train de se réveiller).
 * Jamais de message d'erreur : un écran d'attente stable qui vérifie l'API, puis recharge
 * entièrement la page (comme F5) dès qu'elle répond.
 */
export default function AppError({ error }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    let isStopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const delay = () => (recentReloads().length >= 3 ? SLOW_POLL_MS : POLL_MS);

    const check = async () => {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        if (!isStopped && response.ok) {
          try {
            sessionStorage.setItem(RELOADS_KEY, JSON.stringify([...recentReloads(), Date.now()]));
          } catch {
            // stockage indisponible : on recharge quand même
          }
          window.location.reload();
          return;
        }
      } catch {
        // réseau ou serveur indisponible : nouvel essai plus tard
      }
      if (!isStopped) timer = setTimeout(check, delay());
    };

    timer = setTimeout(check, 1_000);
    return () => {
      isStopped = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div role="status" aria-live="polite" className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span
        aria-hidden="true"
        className="size-10 animate-spin rounded-full border-4 border-border border-t-brand"
      />
      <p className="text-lg font-semibold">Démarrage du service…</p>
      <p className="max-w-sm text-sm text-muted">
        Le service se met en route après une période d’inactivité. Cela peut prendre une minute, la page se
        chargera automatiquement.
      </p>
    </div>
  );
}
