import { Suspense, type ReactNode } from "react";
import { LiveUpdates } from "@/components/live-updates";
import { MainNav, MainNavFallback } from "@/components/main-nav";
import { Skeleton } from "@/components/ui";
import Loading from "./loading";
import { UserMenu } from "@/components/user-menu";
import { getViewer } from "@/lib/viewer";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 border-b border-border bg-surface px-4 py-4 md:sticky md:top-0 md:h-dvh md:w-60 md:border-r md:border-b-0 md:py-6">
        <div className="flex items-center justify-between md:block">
          <p className="px-2 text-xl font-semibold tracking-tight">
            <span className="text-brand">●</span> Ronde
          </p>
          <LiveUpdates />
        </div>
        <Suspense fallback={<MainNavFallback />}>
          <MainNav />
        </Suspense>
        <div className="md:mt-auto">
          <Suspense fallback={<Skeleton className="h-12" />}>
            <UserMenu />
          </Suspense>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <Suspense fallback={<Loading />}>
          <ManagerOnly>{children}</ManagerOnly>
        </Suspense>
      </main>
    </div>
  );
}

/** Le back-office est réservé aux responsables ; les techniciens utilisent l'app mobile. */
async function ManagerOnly({ children }: { children: ReactNode }) {
  const viewer = await getViewer();
  if (viewer.role !== "MANAGER") {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h1 className="text-xl font-semibold">Bonjour {viewer.name.split(" ")[0]} 👋</h1>
        <p className="mt-2 text-muted">
          Le back-office est réservé aux responsables planning. Retrouvez vos interventions dans
          l&apos;application mobile Ronde.
        </p>
      </div>
    );
  }
  return children;
}
