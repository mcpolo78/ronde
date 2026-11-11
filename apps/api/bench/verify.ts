/**
 * Vérifie que l'agrégation SQL du tableau de bord (src/dashboard.ts) donne exactement les mêmes
 * indicateurs que le calcul de référence en TypeScript (packages/domain/src/kpi.ts), sur la base de charge.
 *   pnpm exec tsx --env-file-if-exists=.env bench/verify.ts
 */
import { arrivalDelayMinutes, average, firstTimeFixRate, onSiteDurationMinutes } from "@ronde/domain";
import { dashboardStats } from "../src/dashboard";
import { prisma } from "../src/db";

const DAY = 86_400_000;
const now = Date.now();
const cases = ["bc0001", "bc0002", "bc0017", "bc0060"].flatMap((companyId) =>
  [1, 7, 30, 90].map((days) => ({ companyId, from: new Date(now - days * DAY), to: new Date(now + DAY) })),
);
cases.push({ companyId: "bc0001", from: new Date(now + 400 * DAY), to: new Date(now + 401 * DAY) }); // période vide

let failures = 0;
for (const { companyId, from, to } of cases) {
  const rows = await prisma.intervention.findMany({
    where: { companyId, scheduledStart: { gte: from, lt: to } },
    select: { status: true, scheduledStart: true, visitNumber: true, events: { select: { status: true, at: true }, orderBy: { at: "asc" } } },
  });
  const expected = {
    total: rows.length,
    done: rows.filter((r) => r.status === "DONE").length,
    inProgress: rows.filter((r) => r.status === "EN_ROUTE" || r.status === "ON_SITE").length,
    avgOnSiteMinutes: average(rows.map(onSiteDurationMinutes)),
    avgArrivalDelayMinutes: average(rows.map(arrivalDelayMinutes)),
    firstTimeFixRate: firstTimeFixRate(rows),
  };
  const actual = await dashboardStats(companyId, from, to);
  const same = (Object.keys(expected) as (keyof typeof expected)[]).every((k) => {
    const a = expected[k];
    const b = actual[k];
    return a === null || b === null ? a === b : Math.abs(a - b) < 1e-9;
  });
  if (!same) failures++;
  const days = Math.round((to.getTime() - from.getTime()) / DAY);
  console.log(`${same ? "OK  " : "ÉCART"} ${companyId} ${String(days).padStart(3)} j : ${rows.length} interventions`, same ? "" : { expected, actual });
}
await prisma.$disconnect();
if (failures) {
  console.error(`${failures} écart(s)`);
  process.exit(1);
}
console.log("Les deux calculs concordent sur tous les cas.");
