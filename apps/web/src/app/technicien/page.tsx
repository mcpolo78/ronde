import type { Metadata } from "next";
import { Suspense } from "react";
import { IdleSignOut } from "@/components/idle-sign-out";
import { SignOutButton } from "@/components/sign-out-button";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Espace technicien — Ronde" };

/** Un technicien connecté au back-office est renvoyé ici : son outil, c'est l'app mobile. */
export default function TechnicianPage() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center px-4 py-24 text-center">
      <IdleSignOut />
      <p className="text-3xl font-semibold tracking-tight">
        <span className="text-brand">●</span> Ronde
      </p>
      <Suspense fallback={<h1 className="mt-6 text-xl font-semibold">Bonjour 👋</h1>}>
        <Greeting />
      </Suspense>
      <p className="mt-2 text-muted">
        Le back-office est réservé aux responsables planning. Retrouvez vos interventions dans
        l&apos;application mobile Ronde.
      </p>
      <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted">
        Se déconnecter <SignOutButton />
      </div>
    </main>
  );
}

async function Greeting() {
  const viewer = await getViewer();
  return <h1 className="mt-6 text-xl font-semibold">Bonjour {viewer.name.split(" ")[0]} 👋</h1>;
}
