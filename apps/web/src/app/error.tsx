"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

/** Intervalle entre deux vérifications de l'API. */
const POLL_MS = 4_000;
/** Intervalle plus long si la page a déjà été rechargée plusieurs fois en une minute. */
const SLOW_POLL_MS = 15_000;
const RELOADS_KEY = "ronde:reloads";
/**
 * Rechargements récents au-delà desquels on abandonne : l'API répond, mais la page échoue
 * toujours (droits, bug, base en panne). Inutile de recharger à l'infini.
 */
const MAX_RELOADS = 5;
const RELOADS_WINDOW_MS = 5 * 60_000;

/** Rechargements des 5 dernières minutes (mémorisés le temps de l'onglet). */
function recentReloads(): number[] {
  try {
    const now = Date.now();
    const stored = JSON.parse(sessionStorage.getItem(RELOADS_KEY) ?? "[]") as number[];
    return stored.filter((time) => now - time < RELOADS_WINDOW_MS);
  } catch {
    return [];
  }
}

/**
 * Affiché quand une page n'a pas pu charger ses données (API en train de se réveiller).
 * Jamais de message d'erreur : un écran d'attente stable qui vérifie l'API, puis recharge
 * entièrement la page (comme F5) dès qu'elle répond.
 */
export default function AppError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  const [hasGivenUp, setHasGivenUp] = useState(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    let isStopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const delay = () => (recentReloads().length >= 3 ? SLOW_POLL_MS : POLL_MS);

    const check = async () => {
      if (recentReloads().length >= MAX_RELOADS) {
        setHasGivenUp(true);
        return;
      }
      try {
        const response = await fetch("/api/health?wake", { cache: "no-store", signal: AbortSignal.timeout(15_000) });
        if (!isStopped && ((await response.json()) as { isUp?: boolean }).isUp === true) {
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

  if (hasGivenUp) {
    return (
      <div role="alert" className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-semibold">Le service rencontre un problème</p>
        <p className="max-w-sm text-sm text-muted">
          Le serveur répond, mais cette page n’a pas pu se charger. Réessayez dans quelques instants.
        </p>
        <Button
          type="button"
          variant="primary"
          onClick={() => {
            try {
              sessionStorage.removeItem(RELOADS_KEY);
            } catch {
              // stockage indisponible : on recharge quand même
            }
            window.location.reload();
          }}
        >
          Réessayer
        </Button>
      </div>
    );
  }

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
