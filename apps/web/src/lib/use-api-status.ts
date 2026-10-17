"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ApiStatus = "checking" | "waking" | "up";

const POLL_MS = 3_000;

/**
 * Suit l'état de l'API de démo depuis le navigateur, via /api/health.
 * La vérification démarre dès l'affichage : le simple fait d'ouvrir la page réveille l'API
 * (hébergement gratuit en veille), pendant que le visiteur lit et tape ses identifiants.
 */
export function useApiStatus() {
  const [status, setStatus] = useState<ApiStatus>("checking");
  const [round, setRound] = useState(0); // chaque nouvelle valeur relance une série de vérifications
  const isUp = useRef(false);
  const waiters = useRef<Array<() => void>>([]);

  useEffect(() => {
    let isStopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = async () => {
      let up = false;
      try {
        up = (await fetch("/api/health", { cache: "no-store" })).ok;
      } catch {
        up = false;
      }
      if (isStopped) return;
      if (up) {
        isUp.current = true;
        setStatus("up");
        waiters.current.splice(0).forEach((resolve) => resolve());
        return;
      }
      setStatus("waking");
      timer = setTimeout(() => void check(), POLL_MS);
    };

    // Pas de réponse rapide : l'API dort, on l'annonce sans attendre la fin de la vérification
    const slow = setTimeout(() => setStatus((current) => (current === "checking" ? "waking" : current)), 2_000);
    void check();
    return () => {
      isStopped = true;
      clearTimeout(timer);
      clearTimeout(slow);
    };
  }, [round]);

  /** Résout dès que l'API répond (tout de suite si elle est déjà prête). */
  const whenUp = useCallback(
    () =>
      isUp.current
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            waiters.current.push(resolve);
          }),
    [],
  );

  /** L'API a cessé de répondre (requête en échec) : on repart en vérification. */
  const recheck = useCallback(() => {
    isUp.current = false;
    setStatus("waking");
    setRound((n) => n + 1);
  }, []);

  return { status, whenUp, recheck };
}
