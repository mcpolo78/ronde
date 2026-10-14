"use client";

import { STATUS_LABELS, type InterventionStatus } from "@ronde/domain";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { formatTimeRange } from "@/lib/format";
import type { InterventionRow } from "@/lib/queries";

// Tuiles vectorielles OpenFreeMap (données OpenStreetMap) : libres, sans clé d'API
const STYLES = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

const STATUS_VAR: Record<InterventionStatus, string> = {
  PLANNED: "--status-planned",
  EN_ROUTE: "--status-en-route",
  ON_SITE: "--status-on-site",
  DONE: "--status-done",
  CANCELLED: "--status-cancelled",
};

function describe(i: InterventionRow) {
  return `${formatTimeRange(i.scheduledStart, i.scheduledEnd)}, ${i.type}, ${i.site.customer.name}, ${
    i.technician?.name ?? "non assignée"
  }, ${STATUS_LABELS[i.status]}`;
}

/** Contenu de l'infobulle, construit sans HTML brut (les données viennent des utilisateurs). */
function popupContent(i: InterventionRow) {
  const root = document.createElement("div");
  root.className = "text-sm";
  const title = document.createElement("a");
  title.href = `/interventions/${i.id}`;
  title.textContent = i.type;
  title.className = "font-semibold text-brand hover:underline";
  const lines = [
    formatTimeRange(i.scheduledStart, i.scheduledEnd),
    `${i.site.customer.name} · ${i.site.city}`,
    `${i.technician?.name ?? "Non assignée"} · ${STATUS_LABELS[i.status]}`,
  ].map((text) => {
    const p = document.createElement("p");
    p.textContent = text;
    return p;
  });
  root.append(title, ...lines);
  return root;
}

export function InterventionsMap({ interventions }: { interventions: InterventionRow[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [visible, setVisible] = useState(false);

  // La carte (WebGL) coûte ~1 s de calcul : on ne la crée qu'à l'approche de l'écran,
  // pour ne pas ralentir l'affichage du reste du tableau de bord.
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = container.current;
    if (!element || !visible) return;
    let disposed = false;
    let cleanup = () => {};

    void (async () => {
      const maplibre = await import("maplibre-gl");
      if (disposed) return;
      maplibre.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs"); // copié par scripts/copy-maplibre-worker.mjs
      const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      let map: import("maplibre-gl").Map;
      try {
        map = new maplibre.Map({
          container: element,
          style: dark ? STYLES.dark : STYLES.light,
          center: [2.35, 48.86],
          zoom: 10,
          attributionControl: { compact: true },
          cooperativeGestures: true, // la page reste défilable : zoom à la molette avec Ctrl
        });
      } catch {
        setUnavailable(true); // pas de WebGL
        return;
      }
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");

      const styles = getComputedStyle(document.documentElement);
      const bounds = new maplibre.LngLatBounds();
      const markers = interventions.map((i) => {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("aria-label", describe(i));
        button.title = describe(i);
        button.className = "size-6 rounded-full border-[3px] border-white shadow-md focus-visible:outline-2"; // 24 px : cible tactile minimale
        button.style.background = styles.getPropertyValue(STATUS_VAR[i.status]);
        const lngLat: [number, number] = [i.site.longitude, i.site.latitude];
        bounds.extend(lngLat);
        return new maplibre.Marker({ element: button })
          .setLngLat(lngLat)
          .setPopup(new maplibre.Popup({ offset: 12, closeButton: true }).setDOMContent(popupContent(i)))
          .addTo(map);
      });
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 0 });

      // Interventions proches à l'écran (même immeuble, même quartier) : les marqueurs se
      // chevaucheraient. À chaque zoom, on les écarte jusqu'à MIN_GAP px les uns des autres
      // (relaxation itérative) : chacun reste une cible distincte d'au moins 24 px (WCAG 2.5.8).
      const MIN_GAP = 28;
      const spread = () => {
        const anchors = markers.map((m) => map.project(m.getLngLat()));
        const positions = anchors.map((p, i) => ({ x: p.x + ((i * 7) % 3) * 0.01, y: p.y })); // départage les points confondus
        for (let iteration = 0; iteration < 60; iteration++) {
          let moved = false;
          for (let a = 0; a < positions.length; a++) {
            for (let b = a + 1; b < positions.length; b++) {
              const pa = positions[a]!;
              const pb = positions[b]!;
              const dx = pb.x - pa.x;
              const dy = pb.y - pa.y;
              const distance = Math.hypot(dx, dy) || 0.01;
              if (distance >= MIN_GAP) continue;
              const push = (MIN_GAP - distance) / 2 + 0.5;
              pa.x -= (dx / distance) * push;
              pa.y -= (dy / distance) * push;
              pb.x += (dx / distance) * push;
              pb.y += (dy / distance) * push;
              moved = true;
            }
          }
          if (!moved) break;
        }
        markers.forEach((m, i) => m.setOffset([positions[i]!.x - anchors[i]!.x, positions[i]!.y - anchors[i]!.y]));
      };
      spread();
      map.on("zoomend", spread);

      cleanup = () => {
        markers.forEach((m) => m.remove());
        map.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [interventions, visible]);

  if (unavailable) {
    return <p className="text-sm text-muted">La carte n&apos;est pas disponible sur ce navigateur.</p>;
  }

  return (
    <div>
      <div
        ref={container}
        role="region"
        aria-label="Carte des interventions du jour"
        className="h-80 overflow-hidden rounded-lg border border-border md:h-96"
      />
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Légende">
        {(Object.keys(STATUS_VAR) as InterventionStatus[]).map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: `var(${STATUS_VAR[status]})` }} />
            {STATUS_LABELS[status]}
          </li>
        ))}
      </ul>
    </div>
  );
}
