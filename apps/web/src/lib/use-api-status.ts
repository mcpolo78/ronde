"use client";

import { useCallback, useEffect, useState } from "react";

export type ApiStatus = "checking" | "waking" | "up";

/** Intervalle entre deux vérifications pendant le réveil de l'API. */
export const CHECK_EVERY_SECONDS = 30;

/**
 * Suit l'état de l'API de démo depuis le navigateur, via /api/health.
 * Une vérification tout de suite (elle réveille l'API, en veille sur l'hébergement gratuit),
 * puis une toutes les 30 s jusqu'à ce que l'API réponde.
 */
export function useApiStatus() {
  const [status, setStatus] = useState<ApiStatus>("checking");
  const [round, setRound] = useState(0); // chaque nouvelle valeur relance les vérifications
  const [secondsToNextCheck, setSecondsToNextCheck] = useState(CHECK_EVERY_SECONDS);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isStopped = false;
    let countdown: ReturnType<typeof setInterval> | undefined;

    const check = async () => {
      clearInterval(countdown);
      setIsChecking(true);
      let up = false;
      try {
        // délai côté navigateur : une vérification bloquée ne doit pas figer l'écran d'attente
        const response = await fetch("/api/health?wake", { cache: "no-store", signal: AbortSignal.timeout(15_000) });
        up = ((await response.json()) as { isUp?: boolean }).isUp === true;
      } catch {
        up = false;
      }
      if (isStopped) return;
      setIsChecking(false);
      if (up) {
        setStatus("up");
        return;
      }
      setStatus("waking");
      let left = CHECK_EVERY_SECONDS;
      setSecondsToNextCheck(left);
      countdown = setInterval(() => {
        left -= 1;
        setSecondsToNextCheck(left);
        if (left <= 0) void check();
      }, 1_000);
    };

    void check();
    return () => {
      isStopped = true;
      clearInterval(countdown);
    };
  }, [round]);

  /** L'API a cessé de répondre : on masque à nouveau le formulaire et on revérifie. */
  const recheck = useCallback(() => {
    setStatus("waking");
    setSecondsToNextCheck(CHECK_EVERY_SECONDS);
    setRound((n) => n + 1);
  }, []);

  return { status, secondsToNextCheck, isChecking, recheck };
}
