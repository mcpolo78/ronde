"use client";

import { useEffect, useState } from "react";
import { TourReplay } from "./tour-replay";

/** Durée de réveil annoncée au visiteur (hébergement gratuit de l'API). */
export const EXPECTED_WAKE_SECONDS = 120;

/**
 * Écran affiché à la place du formulaire tant que l'API de démo ne répond pas :
 * temps écoulé, prochaine vérification, et une progression indicative.
 */
export function WakeUpScreen({
  secondsToNextCheck,
  isChecking,
}: {
  secondsToNextCheck: number;
  isChecking: boolean;
}) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1_000);
    return () => clearInterval(timer);
  }, []);
  const percent = Math.min(95, Math.round((seconds / EXPECTED_WAKE_SECONDS) * 100));

  return (
    <div className="flex flex-col items-center gap-4 text-center text-sm">
      <div>
        <p role="status" className="font-medium">Démarrage du serveur de démo…</p>
        <p className="mt-1 text-muted">
          L&apos;hébergement gratuit met le serveur en veille : son réveil prend jusqu&apos;à 2 minutes.
          La connexion s&apos;affichera dès qu&apos;il répond. En attendant, une journée de tournée
          en accéléré :
        </p>
      </div>
      <TourReplay />
      <div
        role="progressbar"
        aria-label="Démarrage du serveur de démo"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-1000"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p aria-hidden="true" className="text-xs text-muted">
        {seconds} s écoulées ·{" "}
        {isChecking ? "vérification…" : `prochaine vérification dans ${Math.max(0, secondsToNextCheck)} s`}
      </p>
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
