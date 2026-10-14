import { dayKey, weekRange } from "@ronde/domain";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatShortDay } from "@/lib/format";

/** Navigation semaine par semaine ; conserve les autres filtres dans l'URL. */
export function WeekNav({
  basePath,
  week,
  params = {},
}: {
  basePath: string;
  week: Date;
  params?: Record<string, string | string[] | undefined>;
}) {
  const href = (target: Date) => {
    const search = new URLSearchParams({ week: dayKey(target) });
    for (const [key, value] of Object.entries(params)) {
      for (const v of [value ?? []].flat()) search.append(key, v);
    }
    return `${basePath}?${search}`;
  };
  const previous = new Date(week.getTime() - 3 * 86_400_000);
  const next = new Date(week.getTime() + 10 * 86_400_000);
  const lastDay = new Date(weekRange(week).to.getTime() - 3 * 86_400_000); // vendredi

  return (
    <nav aria-label="Semaine" className="flex items-center gap-1">
      <Link href={href(previous)} className="rounded-lg border border-border bg-surface p-2 hover:bg-surface-muted" aria-label="Semaine précédente">
        <ChevronLeft aria-hidden className="size-4" />
      </Link>
      <p className="min-w-52 px-2 text-center text-sm font-medium" aria-live="polite">
        Semaine du {formatShortDay(week)} au {formatShortDay(lastDay)}
      </p>
      <Link href={href(next)} className="rounded-lg border border-border bg-surface p-2 hover:bg-surface-muted" aria-label="Semaine suivante">
        <ChevronRight aria-hidden className="size-4" />
      </Link>
      <Link href={basePath} className="ml-1 rounded-lg px-2 py-1.5 text-sm text-brand hover:bg-surface-muted">
        Aujourd&apos;hui
      </Link>
    </nav>
  );
}
