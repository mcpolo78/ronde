-- Compteur de références par entreprise : remplace le COUNT(*) fait à chaque création,
-- qui attribuait le même numéro à deux créations simultanées.
ALTER TABLE "Company" ADD COLUMN "lastReferenceNumber" INTEGER NOT NULL DEFAULT 0;

-- Reprise de l'existant : le plus grand entre le nombre d'interventions (ancienne règle)
-- et le plus grand numéro déjà attribué au format INT-AAAA-NNNN.
UPDATE "Company" c
SET "lastReferenceNumber" = greatest(s.total, s.highest)
FROM (
  SELECT "companyId",
         count(*)::int AS total,
         coalesce(max(substring(reference FROM '^INT-\d{4}-(\d+)$')::int), 0) AS highest
  FROM "Intervention"
  GROUP BY "companyId"
) s
WHERE s."companyId" = c.id;
