"use client";

import { useEffect, useState } from "react";

/** Délais entre deux nouvelles tentatives : rapide au début, puis plus espacé. */
const RETRY_DELAYS_MS = [3_000, 5_000, 10_000, 15_000];

/**
 * Affiché quand une page n'a pas pu charger ses données (API en train de se réveiller).
 * Jamais de message d'erreur : un indicateur d'attente, et une nouvelle tentative
 * automatique jusqu'à ce que l'API réponde.
 */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]!;
    const timer = setTimeout(() => {
      setAttempt((n) => n + 1);
      reset();
    }, delay);
    return () => clearTimeout(timer);
  }, [attempt, reset]);

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
