"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Field, inputClasses } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email ou mot de passe incorrect.",
  TOO_MANY_REQUESTS: "Trop de tentatives, réessayez dans une minute.",
};

/** N'accepte qu'un chemin interne, pour éviter les redirections ouvertes (?next=https://…). */
function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const { error } = await authClient.signIn.email({
        email: String(formData.get("email")),
        password: String(formData.get("password")),
      });
      if (error) {
        setError(ERROR_MESSAGES[error.code ?? ""] ?? "Connexion impossible. Réessayez.");
        return;
      }
      router.replace(safeNext(searchParams.get("next")));
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-4" noValidate={false}>
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
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}
