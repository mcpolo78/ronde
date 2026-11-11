import { prisma } from "./db";

export interface DashboardStats {
  total: number;
  done: number;
  inProgress: number;
  avgOnSiteMinutes: number | null;
  avgArrivalDelayMinutes: number | null;
  firstTimeFixRate: number | null;
}

/**
 * Indicateurs d'une période, agrégés par PostgreSQL : une seule ligne revient, quelle que soit la période.
 *
 * Avant, le résolveur chargeait chaque intervention et son historique puis calculait en JavaScript :
 * 3 700 interventions et 10 800 événements pour 30 jours d'une entreprise de 40 techniciens, et une
 * erreur au-delà de 32 767 interventions (limite de paramètres d'une requête préparée).
 *
 * Mêmes règles que packages/domain/src/kpi.ts, qui reste la référence testée :
 * `floor(x + 0.5)` reproduit Math.round, `min(at)` le premier événement du statut.
 * bench/verify.ts compare les deux calculs sur le jeu de données de charge.
 */
export async function dashboardStats(companyId: string, from: Date, to: Date): Promise<DashboardStats> {
  const [row] = await prisma.$queryRaw<[DashboardStats]>`
    SELECT
      count(*)::int AS "total",
      count(*) FILTER (WHERE i.status = 'DONE')::int AS "done",
      count(*) FILTER (WHERE i.status IN ('EN_ROUTE', 'ON_SITE'))::int AS "inProgress",
      avg(floor(extract(epoch FROM (e.done_at - e.on_site_at)) / 60 + 0.5))::float8 AS "avgOnSiteMinutes",
      avg(floor(extract(epoch FROM (e.on_site_at - i."scheduledStart")) / 60 + 0.5))::float8 AS "avgArrivalDelayMinutes",
      (count(*) FILTER (WHERE i.status = 'DONE' AND i."visitNumber" = 1))::float8
        / nullif(count(*) FILTER (WHERE i.status = 'DONE'), 0) AS "firstTimeFixRate"
    FROM "Intervention" i
    LEFT JOIN LATERAL (
      SELECT min(s.at) FILTER (WHERE s.status = 'ON_SITE') AS on_site_at,
             min(s.at) FILTER (WHERE s.status = 'DONE') AS done_at
      FROM "StatusEvent" s
      WHERE s."interventionId" = i.id
    ) e ON true
    WHERE i."companyId" = ${companyId}
      AND i."scheduledStart" >= ${from}
      AND i."scheduledStart" < ${to}`;
  return row;
}
