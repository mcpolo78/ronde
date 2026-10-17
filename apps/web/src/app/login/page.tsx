import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion — Ronde" };

export default function LoginPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-3xl font-semibold tracking-tight">
            <span className="text-brand">●</span> Ronde
          </p>
          <h1 className="mt-2 text-sm text-muted">Connexion au back-office</h1>
        </div>
        <Suspense>
          <LoginForm demoAccount={<DemoAccount />} />
        </Suspense>
      </div>
    </main>
  );
}

function DemoAccount() {
  return (
    <aside className="mt-6 rounded-xl border border-dashed border-border p-4 text-sm">
      <p className="font-medium">Compte de démonstration</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted">
        <dt>Email</dt>
        <dd className="font-mono text-foreground">claire@ronde.demo</dd>
        <dt>Mot de passe</dt>
        <dd className="font-mono text-foreground">demo-ronde</dd>
      </dl>
    </aside>
  );
}
