"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const SUBSCRIPTION = "subscription { interventionUpdated { id } }";

/**
 * Abonnement temps réel (subscription GraphQL via SSE) : à chaque changement
 * d'intervention, les Server Components de la page sont rafraîchis.
 * Les rafales d'événements sont regroupées pour ne pas recharger en boucle.
 */
export function LiveUpdates() {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const source = new EventSource(`/api/graphql?query=${encodeURIComponent(SUBSCRIPTION)}`);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false); // EventSource se reconnecte tout seul
    source.addEventListener("next", () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 400);
    });
    return () => {
      clearTimeout(timer.current);
      source.close();
    };
  }, [router]);

  return (
    <p
      className="flex items-center gap-2 px-2 text-xs text-muted md:mt-2"
      role="status"
      title={connected ? "Les changements s'affichent en temps réel" : "Reconnexion en cours…"}
    >
      <span
        aria-hidden
        className={`size-2 rounded-full ${connected ? "bg-[var(--status-done)]" : "bg-[var(--status-en-route)]"}`}
      />
      {connected ? "En direct" : "Hors ligne"}
    </p>
  );
}
