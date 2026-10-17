"use client";

import { useEffect, useState } from "react";

/** Durée réelle d'une journée rejouée (8 h → 18 h), en secondes. */
const REPLAY_SECONDS = 120;
const DAY_START_MINUTES = 8 * 60;
const DAY_MINUTES = 10 * 60;
const TECHNICIANS = 6;
const STOPS_PER_TECHNICIAN = 5;
/** Sur une tournée : part du trajet et de l'intervention dans chaque étape. */
const TRAVEL_SHARE = 0.35;

type Point = { x: number; y: number };
type Status = "planned" | "on-site" | "done";

/** Générateur pseudo-aléatoire déterministe : la même journée à chaque affichage. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

const DEPOT: Point = { x: 160, y: 104 };

/** Six tournées de cinq interventions, réparties dans Paris (ellipse du périphérique). */
const ROUTES: Point[][] = (() => {
  const next = random(42);
  return Array.from({ length: TECHNICIANS }, (_, t) => {
    const base = (t / TECHNICIANS) * Math.PI * 2;
    return Array.from({ length: STOPS_PER_TECHNICIAN }, (_, s) => {
      const angle = base + (s / STOPS_PER_TECHNICIAN) * 1.1 + next() * 0.3;
      const radius = 0.3 + 0.65 * ((s + 1) / STOPS_PER_TECHNICIAN) * (0.75 + next() * 0.25);
      return { x: DEPOT.x + Math.cos(angle) * 130 * radius, y: DEPOT.y + Math.sin(angle) * 76 * radius };
    });
  });
})();

/** Position du technicien et état de ses interventions à l'instant `progress` (0 → 1 sur la journée). */
function snapshot(route: Point[], progress: number) {
  const steps = route.length;
  const position = Math.min(progress * steps, steps);
  const index = Math.min(Math.floor(position), steps - 1);
  const within = position - index;
  const from = index === 0 ? DEPOT : route[index - 1]!;
  const to = route[index]!;
  const travel = Math.min(within / TRAVEL_SHARE, 1);
  const technician = {
    x: from.x + (to.x - from.x) * travel,
    y: from.y + (to.y - from.y) * travel,
  };
  const statuses: Status[] = route.map((_, i) => {
    if (i < index || position >= steps) return "done";
    if (i === index && within >= TRAVEL_SHARE) return "on-site";
    return "planned";
  });
  const travelled = [DEPOT, ...route.slice(0, index), technician];
  return { technician, statuses, travelled, isTravelling: position < steps && within < TRAVEL_SHARE };
}

const STATUS_COLORS: Record<Status, string> = {
  planned: "var(--status-planned)",
  "on-site": "var(--status-on-site)",
  done: "var(--status-done)",
};

/**
 * Une journée de tournée rejouée en accéléré pendant le réveil du serveur :
 * six techniciens vont d'intervention en intervention, de 8 h à 18 h en deux minutes.
 * Entièrement dans le navigateur : ne dépend pas de l'API.
 */
export function TourReplay() {
  const [progress, setProgress] = useState(0.35);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const started = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      setProgress((((now - started) / 1000) % REPLAY_SECONDS) / REPLAY_SECONDS);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const snapshots = ROUTES.map((route) => snapshot(route, progress));
  const done = snapshots.reduce((n, s) => n + s.statuses.filter((x) => x === "done").length, 0);
  const minutes = DAY_START_MINUTES + Math.floor(progress * DAY_MINUTES);
  const clock = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

  return (
    <figure className="w-full">
      <svg
        viewBox="0 0 320 208"
        role="img"
        aria-label="Animation : six techniciens réalisent leurs interventions dans Paris au fil d'une journée"
        className="w-full rounded-lg bg-surface-muted"
      >
        {/* Paris : périphérique et Seine */}
        <ellipse cx={DEPOT.x} cy={DEPOT.y} rx="142" ry="86" fill="none" stroke="var(--border)" strokeWidth="6" />
        <path
          d="M 14 70 C 70 60, 100 120, 160 112 S 250 70, 306 132"
          fill="none"
          stroke="var(--status-on-site-bg)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        {ROUTES.map((route, t) => (
          <g key={t}>
            <polyline
              points={[DEPOT, ...route].map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="var(--border)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            <polyline
              points={snapshots[t]!.travelled.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="var(--brand)"
              strokeOpacity="0.55"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {route.map((stop, s) => {
              const status = snapshots[t]!.statuses[s]!;
              return (
                <circle
                  key={s}
                  cx={stop.x}
                  cy={stop.y}
                  r={status === "on-site" ? 5 : 4}
                  fill={status === "planned" ? "var(--surface)" : STATUS_COLORS[status]}
                  stroke={STATUS_COLORS[status]}
                  strokeWidth="1.5"
                />
              );
            })}
          </g>
        ))}
        <rect x={DEPOT.x - 5} y={DEPOT.y - 5} width="10" height="10" rx="2" fill="var(--brand)" />
        {snapshots.map(({ technician, isTravelling }, t) => (
          <circle
            key={t}
            cx={technician.x}
            cy={technician.y}
            r="3.5"
            fill={isTravelling ? "var(--status-en-route)" : "var(--foreground)"}
            stroke="var(--surface)"
            strokeWidth="1.5"
          />
        ))}
        <text x="12" y="22" fontSize="15" fontWeight="600" fill="var(--foreground)" className="tabular-nums">
          {clock}
        </text>
        <text x="308" y="22" fontSize="10" textAnchor="end" fill="var(--muted)" className="tabular-nums">
          {done}/{TECHNICIANS * STOPS_PER_TECHNICIAN} terminées
        </text>
      </svg>
      <figcaption className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span aria-hidden="true" className="size-2 rounded-full bg-[var(--status-en-route)]" /> En route
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden="true" className="size-2 rounded-full bg-[var(--status-on-site)]" /> Sur place
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden="true" className="size-2 rounded-full bg-[var(--status-done)]" /> Terminée
        </span>
      </figcaption>
    </figure>
  );
}
