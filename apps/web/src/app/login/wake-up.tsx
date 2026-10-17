"use client";

import { useState } from "react";
import type { ApiStatus } from "@/lib/use-api-status";

/** Durée de réveil annoncée au visiteur (hébergement gratuit de l'API). */
export const EXPECTED_WAKE_SECONDS = 120;

const spinner =
  "inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-border border-t-brand";

/** État du serveur de démo, affiché sous le formulaire dès l'ouverture de la page. */
export function ApiStatusBadge({ status }: { status: ApiStatus }) {
  return (
    <p
      role="status"
      className="flex items-center justify-center gap-2 text-xs text-muted"
    >
      {status === "up" ? (
        <>
          <span aria-hidden="true" className="size-2 rounded-full bg-brand" />
          Serveur de démo prêt
        </>
      ) : (
        <>
          <span aria-hidden="true" className={spinner} />
          {status === "checking"
            ? "Vérification du serveur de démo…"
            : "Serveur de démo en cours de démarrage (jusqu’à 2 min)…"}
        </>
      )}
    </p>
  );
}

/** Explication et progression pendant une connexion qui attend le réveil de l'API. */
export function WakeUpProgress({ seconds }: { seconds: number }) {
  const percent = Math.min(
    95,
    Math.round((seconds / EXPECTED_WAKE_SECONDS) * 100),
  );
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p aria-live="polite">
        {seconds < 60
          ? "Le serveur de démo se réveille (hébergement gratuit) : comptez jusqu’à 2 minutes. Vous serez connecté automatiquement."
          : "Encore quelques secondes… La connexion se fera dès que le serveur répond."}
      </p>
      <div
        role="progressbar"
        aria-label="Démarrage du serveur de démo"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 overflow-hidden rounded-full bg-surface-muted"
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-1000"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

const SLIDES = [
  {
    title: "Back-office Next.js 16",
    text: "Planning de la semaine, carte du jour et indicateurs, mis à jour en temps réel.",
  },
  {
    title: "App mobile hors ligne",
    text: "Expo / React Native : les techniciens travaillent sans réseau ; une file de synchronisation rejoue leurs actions au retour du réseau.",
  },
  {
    title: "API GraphQL typée",
    text: "GraphQL Yoga, Pothos et Prisma sur PostgreSQL ; requêtes typées de bout en bout avec gql.tada.",
  },
  {
    title: "Qualité",
    text: "Tests unitaires et parcours E2E (Playwright), audit d'accessibilité WCAG 2.2 AA à chaque commit dans la CI.",
  },
];

/** Visite guidée de Ronde, à lire pendant le réveil du serveur (navigation manuelle, rien ne défile seul). */
export function Showcase() {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index]!;
  const go = (step: number) =>
    setIndex((current) => (current + step + SLIDES.length) % SLIDES.length);

  return (
    <section
      aria-labelledby="showcase-title"
      className="mt-6 rounded-xl border border-border bg-surface p-4 text-sm shadow-xs"
    >
      <h2 id="showcase-title" className="font-medium">
        En attendant, découvrez Ronde
      </h2>
      <div aria-live="polite" className="mt-3 min-h-24">
        <p className="font-medium">
          {slide.title}{" "}
          <span className="font-normal text-muted">
            ({index + 1}/{SLIDES.length})
          </span>
        </p>
        <p className="mt-1 text-muted">{slide.text}</p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => go(-1)}
          className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-muted"
        >
          Précédent
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          className="rounded-md border border-border px-3 py-1.5 hover:bg-surface-muted"
        >
          Suivant
        </button>
      </div>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <a
          href="https://github.com/mcpolo78/ronde"
          className="text-brand underline underline-offset-2"
        >
          Code source sur GitHub
        </a>
        <a
          href="https://marcchesnel.vercel.app/projets/ronde"
          className="text-brand underline underline-offset-2"
        >
          Étude de cas
        </a>
      </p>
    </section>
  );
}
