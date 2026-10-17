"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";

/** Déconnexion après 10 min sans activité dans le back-office, tous onglets confondus. */
const IDLE_MS = 10 * 60_000;
const CHECK_EVERY_MS = 30_000;
/** Une activité n'est enregistrée qu'une fois toutes les 30 s (mousemove est très fréquent). */
const SAVE_EVERY_MS = 30_000;
const LAST_ACTIVITY_KEY = "ronde:last-activity";
const SIGNED_OUT_KEY = "ronde:signed-out";
const ACTIVITY_EVENTS = ["pointerdown", "mousemove", "keydown", "scroll", "wheel", "touchstart"] as const;

function read(key: string) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function write(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // stockage indisponible : chaque onglet suit alors sa propre activité
  }
}

export function IdleSignOut() {
  useEffect(() => {
    // dernière activité connue de cet onglet, partagée avec les autres via localStorage
    let lastActivity = Date.now();
    write(LAST_ACTIVITY_KEY, lastActivity);

    const goToLogin = () => window.location.replace("/login?expired=1");

    const onActivity = () => {
      const now = Date.now();
      if (now - lastActivity < SAVE_EVERY_MS) return;
      lastActivity = now;
      write(LAST_ACTIVITY_KEY, now);
    };

    const check = () => {
      const latest = Math.max(lastActivity, read(LAST_ACTIVITY_KEY));
      if (Date.now() - latest < IDLE_MS) return;
      write(SIGNED_OUT_KEY, Date.now()); // les autres onglets suivent
      // keepalive : la requête de déconnexion survit au changement de page qui suit
      void authClient.signOut({ fetchOptions: { keepalive: true } }).catch(() => {
        // API injoignable : la redirection suffit, la session expirera d'elle-même
      });
      goToLogin();
    };

    // un autre onglet a déconnecté la session : celui-ci suit
    const onStorage = (event: StorageEvent) => {
      if (event.key === SIGNED_OUT_KEY) goToLogin();
    };

    const timer = setInterval(check, CHECK_EVERY_MS);
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(timer);
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity));
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
