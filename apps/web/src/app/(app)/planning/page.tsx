import { dayKey, weekRange, workDaysOfWeek } from "@ronde/domain";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ButtonLink, PageHeader, Skeleton } from "@/components/ui";
import { WeekNav } from "@/components/week-nav";
import { gql } from "@/lib/api";
import { InterventionsQuery } from "@/lib/queries";
import { PlanningBoard } from "./planning-board";
import { isManager } from "@/lib/viewer";

export const metadata: Metadata = { title: "Planning — Ronde" };

type SearchParams = Promise<{ week?: string }>;

export default function PlanningPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader
        title="Planning"
        description="Glissez une intervention vers un autre technicien ou un autre jour."
        actions={
          <ButtonLink href="/interventions/new" variant="primary">
            Nouvelle intervention
          </ButtonLink>
        }
      />
      <Suspense fallback={<Skeleton className="h-[560px]" />}>
        <Planning searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Planning({ searchParams }: { searchParams: SearchParams }) {
  if (!(await isManager())) return null;
  const { week: weekParam } = await searchParams;
  await connection();
  const reference = weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam) ? weekParam : new Date();
  const week = weekRange(reference);

  const { interventions, technicians } = await gql(InterventionsQuery, {
    from: week.from.toISOString(),
    to: week.to.toISOString(),
  });

  return (
    <>
      <div className="mb-4">
        <WeekNav basePath="/planning" week={week.from} />
      </div>
      <PlanningBoard
        // remonte le composant au changement de semaine (réinitialise l'état local)
        key={dayKey(week.from)}
        days={workDaysOfWeek(reference).map(dayKey)}
        today={dayKey(new Date())}
        technicians={technicians}
        interventions={interventions}
      />
    </>
  );
}
