import { dayRange, type InterventionStatus } from "@ronde/domain";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { InterventionsMap } from "@/components/interventions-map";
import { Card, EmptyState, PageHeader, PriorityBadge, Skeleton, StatusBadge } from "@/components/ui";
import { gql } from "@/lib/api";
import { formatLongDay, formatMinutes, formatPercent, formatTimeRange } from "@/lib/format";
import { DashboardQuery } from "@/lib/queries";
import { isManager } from "@/lib/viewer";

const PERIOD_DAYS = 30;

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Tableau de bord" description="Activité du jour et indicateurs des 30 derniers jours." />
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </>
  );
}

async function Dashboard() {
  if (!(await isManager())) return null;
  await connection(); // « maintenant » est évalué à la requête, jamais au build
  const now = new Date();
  const today = dayRange(now);
  const periodFrom = new Date(today.to.getTime() - PERIOD_DAYS * 86_400_000);

  const { dashboard, today: interventions, technicians } = await gql(DashboardQuery, {
    from: periodFrom.toISOString(),
    to: today.to.toISOString(),
    todayFrom: today.from.toISOString(),
    todayTo: today.to.toISOString(),
  });

  const countBy = (status: InterventionStatus) => interventions.filter((i) => i.status === status).length;
  const active = interventions.filter((i) => i.status === "EN_ROUTE" || i.status === "ON_SITE");
  const unassigned = interventions.filter((i) => !i.technician && i.status === "PLANNED");
  const urgent = interventions.filter(
    (i) => (i.priority === "URGENT" || i.priority === "HIGH") && i.status === "PLANNED",
  );

  return (
    <>
      <p className="-mt-4 mb-6 text-sm font-medium first-letter:uppercase">{formatLongDay(now)}</p>

      <section aria-labelledby="today-title" className="mb-8">
        <h2 id="today-title" className="sr-only">
          Aujourd&apos;hui
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Interventions aujourd'hui" value={interventions.length} />
          <Stat label="En cours" value={active.length} hint={`${countBy("EN_ROUTE")} en route · ${countBy("ON_SITE")} sur place`} />
          <Stat label="Terminées" value={countBy("DONE")} hint={`sur ${interventions.length - countBy("CANCELLED")} prévues`} />
          <Stat
            label="À traiter"
            value={unassigned.length + urgent.length}
            hint={`${unassigned.length} non assignée(s) · ${urgent.length} prioritaire(s)`}
            tone={unassigned.length + urgent.length > 0 ? "warning" : undefined}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card aria-labelledby="active-title">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="active-title" className="font-semibold">
              Journée par technicien
            </h2>
            <Link href="/planning" className="flex items-center gap-1 text-sm text-brand hover:underline">
              Planning <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </div>
          {technicians.length === 0 ? (
            <EmptyState title="Aucun technicien" />
          ) : (
            <ul className="divide-y divide-border">
              {technicians.map((tech) => {
                const own = interventions.filter((i) => i.technician?.id === tech.id);
                const current = own.find((i) => i.status === "EN_ROUTE" || i.status === "ON_SITE");
                const done = own.filter((i) => i.status === "DONE").length;
                return (
                  <li key={tech.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                    <span className="w-36 font-medium">{tech.name}</span>
                    <Progress done={done} total={own.filter((i) => i.status !== "CANCELLED").length} />
                    <span className="min-w-0 flex-1 text-sm text-muted">
                      {current ? (
                        <Link href={`/interventions/${current.id}`} className="hover:text-foreground">
                          <StatusBadge status={current.status} className="mr-2" />
                          {current.type} · {current.site.city}
                        </Link>
                      ) : own.length === 0 ? (
                        "Aucune intervention"
                      ) : (
                        "Disponible"
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card aria-labelledby="kpi-title">
            <h2 id="kpi-title" className="font-semibold">
              Indicateurs
            </h2>
            <p className="mb-4 text-xs text-muted">{PERIOD_DAYS} derniers jours · {dashboard.done} interventions terminées</p>
            <dl className="grid grid-cols-2 gap-4">
              <Kpi label="Résolution à la 1re visite" value={formatPercent(dashboard.firstTimeFixRate)} />
              <Kpi label="Durée moyenne sur site" value={formatMinutes(dashboard.avgOnSiteMinutes)} />
              <Kpi label="Retard moyen à l'arrivée" value={formatMinutes(dashboard.avgArrivalDelayMinutes)} />
              <Kpi
                label="Taux de réalisation"
                value={formatPercent(dashboard.total ? dashboard.done / dashboard.total : null)}
              />
            </dl>
          </Card>

          <Card aria-labelledby="todo-title">
            <h2 id="todo-title" className="mb-3 font-semibold">
              À traiter
            </h2>
            {unassigned.length + urgent.length === 0 ? (
              <p className="text-sm text-muted">Rien à signaler pour aujourd&apos;hui.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {[...unassigned, ...urgent.filter((u) => !unassigned.includes(u))].map((i) => (
                  <li key={i.id}>
                    <Link
                      href={`/interventions/${i.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-muted"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{i.type}</span>
                        <span className="text-muted">
                          {formatTimeRange(i.scheduledStart, i.scheduledEnd)} · {i.site.city}
                        </span>
                      </span>
                      {i.technician ? <PriorityBadge priority={i.priority} /> : <span className="text-xs font-medium text-danger">Non assignée</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card aria-labelledby="map-title" className="mt-6">
        <h2 id="map-title" className="mb-3 font-semibold">
          Carte du jour
        </h2>
        <InterventionsMap interventions={interventions} />
      </Card>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "warning";
}) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${tone === "warning" ? "text-[var(--status-en-route)]" : ""}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  const ratio = total ? done / total : 0;
  return (
    <span className="flex items-center gap-2 text-xs text-muted tabular-nums">
      <span
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label="Interventions terminées"
        className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-muted"
      >
        <span className="block h-full rounded-full bg-brand" style={{ width: `${ratio * 100}%` }} />
      </span>
      {done}/{total}
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Chargement du tableau de bord">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
