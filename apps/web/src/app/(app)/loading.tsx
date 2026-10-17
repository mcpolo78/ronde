import { Skeleton } from "@/components/ui";

/** Squelette affiché instantanément pendant le chargement des données d'une page. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <p role="status" className="flex items-center gap-2 text-sm text-muted">
        <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-border border-t-brand" />
        Chargement des données…
      </p>
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}
