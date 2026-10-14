import {
  dayKey,
  INTERVENTION_STATUSES,
  STATUS_LABELS,
  weekRange,
  type InterventionStatus,
} from "@ronde/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { WeekNav } from "@/components/week-nav";
import { Button, ButtonLink, EmptyState, inputClasses, PageHeader, PriorityBadge, Skeleton, StatusBadge } from "@/components/ui";
import { gql } from "@/lib/api";
import { formatShortDay, formatTimeRange } from "@/lib/format";
import { InterventionsQuery } from "@/lib/queries";
import { isManager } from "@/lib/viewer";

export const metadata: Metadata = { title: "Interventions — Ronde" };

type SearchParams = Promise<{ week?: string; status?: string | string[]; technician?: string }>;

export default function InterventionsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader
        title="Interventions"
        description="Toutes les interventions de la semaine, filtrables par statut et par technicien."
        actions={
          <ButtonLink href="/interventions/new" variant="primary">
            Nouvelle intervention
          </ButtonLink>
        }
      />
      <Suspense fallback={<Skeleton className="h-[480px]" />}>
        <InterventionList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function InterventionList({ searchParams }: { searchParams: SearchParams }) {
  if (!(await isManager())) return null;
  const params = await searchParams;
  await connection();
  const week = weekRange(params.week && /^\d{4}-\d{2}-\d{2}$/.test(params.week) ? params.week : new Date());
  const statuses = [params.status ?? []]
    .flat()
    .filter((s): s is InterventionStatus => (INTERVENTION_STATUSES as readonly string[]).includes(s));
  const technicianId = params.technician || undefined;

  const { interventions, technicians } = await gql(InterventionsQuery, {
    from: week.from.toISOString(),
    to: week.to.toISOString(),
    status: statuses.length ? statuses : undefined,
    technicianId,
  });

  return (
    <>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <WeekNav basePath="/interventions" week={week.from} params={{ status: statuses, technician: technicianId }} />
        <form className="flex flex-wrap items-end gap-3" aria-label="Filtres">
          <input type="hidden" name="week" value={dayKey(week.from)} />
          <fieldset className="flex flex-wrap gap-1.5">
            <legend className="sr-only">Statuts</legend>
            {INTERVENTION_STATUSES.map((status) => (
              <label
                key={status}
                className="cursor-pointer rounded-full border border-border px-3 py-1 text-xs has-checked:border-brand has-checked:bg-brand-soft has-checked:text-brand-strong"
              >
                <input type="checkbox" name="status" value={status} defaultChecked={statuses.includes(status)} className="sr-only" />
                {STATUS_LABELS[status]}
              </label>
            ))}
          </fieldset>
          <label className="sr-only" htmlFor="technician">
            Technicien
          </label>
          <select id="technician" name="technician" defaultValue={technicianId ?? ""} className={`${inputClasses} h-9 w-48`}>
            <option value="">Tous les techniciens</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm">
            Filtrer
          </Button>
        </form>
      </div>

      <p className="mb-3 text-sm text-muted" aria-live="polite">
        {interventions.length} intervention{interventions.length > 1 ? "s" : ""} sur la période
      </p>
      {interventions.length === 0 ? (
        <EmptyState title="Aucune intervention">Modifiez les filtres ou changez de semaine.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[760px] text-left text-sm">
            <caption className="sr-only">Liste des interventions</caption>
            <thead className="border-b border-border text-xs text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Référence</th>
                <th scope="col" className="px-4 py-3 font-medium">Créneau</th>
                <th scope="col" className="px-4 py-3 font-medium">Client · site</th>
                <th scope="col" className="px-4 py-3 font-medium">Type</th>
                <th scope="col" className="px-4 py-3 font-medium">Technicien</th>
                <th scope="col" className="px-4 py-3 font-medium">Priorité</th>
                <th scope="col" className="px-4 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {interventions.map((i) => (
                <tr key={i.id} className="hover:bg-surface-muted">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link href={`/interventions/${i.id}`} className="text-brand hover:underline">
                      {i.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="first-letter:uppercase">{formatShortDay(i.scheduledStart)}</span>
                    <span className="block text-xs text-muted">{formatTimeRange(i.scheduledStart, i.scheduledEnd)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {i.site.customer.name}
                    <span className="block text-xs text-muted">
                      {i.site.label} · {i.site.city}
                    </span>
                  </td>
                  <td className="px-4 py-3">{i.type}</td>
                  <td className="px-4 py-3">{i.technician?.name ?? <span className="text-danger">Non assignée</span>}</td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={i.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={i.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
