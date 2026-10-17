"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Button, Field, inputClasses } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { useApiStatus } from "@/lib/use-api-status";
import { ApiStatusBadge, Showcase, WakeUpProgress } from "./wake-up";

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email ou mot de passe incorrect.",
  TOO_MANY_REQUESTS: "Trop de tentatives, réessayez dans une minute.",
};

/** Nombre de tentatives de connexion quand le serveur ne répond pas encore. */
const MAX_ATTEMPTS = 3;
/** Au-delà de ce délai, une connexion en cours affiche l'explication du réveil. */
const EXPLAIN_AFTER_SECONDS = 3;

/** N'accepte qu'un chemin interne, pour éviter les redirections ouvertes (?next=https://…). */
function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/";
}

export function LoginForm({ demoAccount }: { demoAccount: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, whenUp, recheck } = useApiStatus();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [waitedSeconds, setWaitedSeconds] = useState(0);

  // Chronomètre de l'attente, affiché seulement pendant une connexion en cours
  useEffect(() => {
    if (!pending) return;
    const started = Date.now();
    const timer = setInterval(
      () => setWaitedSeconds(Math.floor((Date.now() - started) / 1000)),
      1_000,
    );
    return () => clearInterval(timer);
  }, [pending]);

  function onSubmit(formData: FormData) {
    setError(null);
    setWaitedSeconds(0);
    startTransition(async () => {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        await whenUp(); // si l'API dort encore, on attend son réveil au lieu d'échouer
        const { data, error } = await authClient.signIn.email({
          email: String(formData.get("email")),
          password: String(formData.get("password")),
        });
        if (!error) {
          // un technicien n'a rien à faire dans le back-office : directement vers sa page
          const role = (data?.user as { role?: string } | undefined)?.role;
          router.replace(
            role === "TECHNICIAN"
              ? "/technicien"
              : safeNext(searchParams.get("next")),
          );
          router.refresh();
          return;
        }
        const isUnavailable =
          !error.code && (!error.status || error.status >= 500);
        if (!isUnavailable) {
          setError(
            ERROR_MESSAGES[error.code ?? ""] ??
              "Connexion impossible. Réessayez.",
          );
          return;
        }
        recheck(); // le serveur ne répond plus : on attend qu'il revienne, puis on retente
      }
      setError(
        "Le serveur de démo met plus de temps que prévu. Réessayez dans un instant.",
      );
    });
  }

  const isWaiting =
    pending && (status !== "up" || waitedSeconds >= EXPLAIN_AFTER_SECONDS);

  return (
    <>
      <div className="rounded-xl border border-border bg-surface p-6 shadow-xs">
        <form
          action={onSubmit}
          className="flex flex-col gap-4"
          noValidate={false}
        >
          <Field label="Email" htmlFor="email">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              defaultValue="claire@ronde.demo"
              className={inputClasses}
            />
          </Field>
          <Field label="Mot de passe" htmlFor="password">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              className={inputClasses}
            />
          </Field>
          <div aria-live="polite" className="min-h-5 text-sm text-danger">
            {error}
          </div>
          {isWaiting && <WakeUpProgress seconds={waitedSeconds} />}
          <Button type="submit" variant="primary" disabled={pending}>
            {pending
              ? isWaiting
                ? "Connexion dès que le serveur répond…"
                : "Connexion…"
              : "Se connecter"}
          </Button>
          <ApiStatusBadge status={status} />
        </form>
      </div>
      {demoAccount}
      {(status !== "up" || isWaiting) && <Showcase />}
    </>
  );
}
