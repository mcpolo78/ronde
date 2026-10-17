"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";

/** Déconnexion après 10 min sans activité dans le back-office. */
const IDLE_MS = 10 * 60_000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "wheel", "touchstart"] as const;

export function IdleSignOut() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const signOut = async () => {
      try {
        await authClient.signOut();
      } catch {
        // API injoignable : on renvoie quand même vers la connexion
      }
      window.location.replace("/login?expired=1");
    };
    const restart = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void signOut(), IDLE_MS);
    };

    restart();
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, restart, { passive: true }));
    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, restart));
    };
  }, []);

  return null;
}
