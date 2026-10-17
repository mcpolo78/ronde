"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Button, Field, inputClasses } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { useApiStatus } from "@/lib/use-api-status";
import { Showcase, WakeUpScreen } from "./wake-up";

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email ou mot de passe incorrect.",
  TOO_MANY_REQUESTS: "Trop de tentatives, réessayez dans une minute.",
};

/** N'accepte qu'un chemin interne, pour éviter les redirections ouvertes (?next=https://…). */
function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/";
}

export function LoginForm({ demoAccount }: { demoAccount: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, secondsToNextCheck, recheck } = useApiStatus();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
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
      if (!error.code && (!error.status || error.status >= 500)) {
        recheck(); // le serveur s'est rendormi : retour à l'écran d'attente
        return;
      }
      setError(
        ERROR_MESSAGES[error.code ?? ""] ?? "Connexion impossible. Réessayez.",
      );
    });
  }

  if (status === "checking") {
    return (
      <p role="status" className="flex items-center justify-center gap-2 text-sm text-muted">
        <span
          aria-hidden="true"
          className="inline-block size-4 animate-spin rounded-full border-2 border-border border-t-brand"
        />
        Vérification du serveur de démo…
      </p>
    );
  }

  if (status === "waking") {
    return (
      <>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-xs">
          <WakeUpScreen secondsToNextCheck={secondsToNextCheck} />
        </div>
        {demoAccount}
        <Showcase />
      </>
    );
  }

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
            {error ??
              (searchParams.get("expired") &&
                "Session fermée après 10 minutes d’inactivité. Reconnectez-vous.")}
          </div>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Connexion…" : "Se connecter"}
          </Button>
        </form>
      </div>
      {demoAccount}
    </>
  );
}
