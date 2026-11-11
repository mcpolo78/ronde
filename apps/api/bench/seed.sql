-- Jeu de données de charge pour le banc de mesure (voir bench/README.md).
-- 60 entreprises de 3 à 40 techniciens, 2 ans d'historique + 30 jours à venir.
-- Déterministe (setseed), tout en SQL pour remplir plusieurs millions de lignes en quelques minutes.
-- Remplace entièrement le contenu de la base : à ne lancer que sur une base de test.
\set ON_ERROR_STOP on
\timing on
SELECT setseed(0.42);

TRUNCATE "Company", "User", "Customer", "Site", "Intervention", "ChecklistItem", "StatusEvent",
         "Photo", "Signature", "StoredFile", "Session", "Account", "PushToken" CASCADE;

-- Entreprises : la n° 1 est la plus grosse (40 techniciens), c'est elle que le banc interroge.
INSERT INTO "Company" (id, name)
SELECT 'bc' || lpad(i::text, 4, '0'), 'Entreprise ' || i FROM generate_series(1, 60) i;

CREATE TEMP TABLE co AS
SELECT i, 'bc' || lpad(i::text, 4, '0') AS id, CASE WHEN i = 1 THEN 40 ELSE 3 + (i * 37 % 30) END AS techs
FROM generate_series(1, 60) i;

INSERT INTO "User" (id, email, name, "emailVerified", role, "companyId", "updatedAt")
SELECT 'bm' || lpad(i::text, 4, '0'), 'manager' || i || '@bench.ronde', 'Manager ' || i, true, 'MANAGER', id, now() FROM co;

INSERT INTO "User" (id, email, name, "emailVerified", role, "companyId", "updatedAt")
SELECT 'bt' || lpad(co.i::text, 4, '0') || lpad(t::text, 3, '0'), 'tech' || co.i || '-' || t || '@bench.ronde',
       'Technicien ' || co.i || '-' || t, true, 'TECHNICIAN', co.id, now()
FROM co, generate_series(1, co.techs) t;

-- 25 clients par technicien, 2 sites par client
INSERT INTO "Customer" (id, name, email, "companyId")
SELECT 'bk' || lpad(co.i::text, 4, '0') || lpad(c::text, 5, '0'), 'Client ' || co.i || '-' || c, 'client' || c || '@exemple.test', co.id
FROM co, generate_series(1, co.techs * 25) c;

INSERT INTO "Site" (id, label, address, city, "postalCode", latitude, longitude, "customerId")
SELECT k.id || 's' || s, 'Site ' || s, (1 + (random() * 120)::int) || ' rue de la Mesure', 'Paris', '75011',
       48.80 + random() * 0.12, 2.25 + random() * 0.2, k.id
FROM "Customer" k, generate_series(1, 2) s;

-- Interventions : 5 créneaux par technicien et par jour ouvré, 15 % de créneaux vides.
CREATE TEMP TABLE slot AS
SELECT co.i, co.id AS company_id, co.techs,
       'bt' || lpad(co.i::text, 4, '0') || lpad(t::text, 3, '0') AS tech_id,
       d::date AS day, n,
       d + make_interval(hours => (ARRAY[8, 10, 13, 15, 17])[n]) AS start_at,
       random() AS r_status, random() AS r_site, random() AS r_misc
FROM co, generate_series(1, co.techs) t,
     generate_series(date_trunc('day', now()) - interval '700 days', date_trunc('day', now()) + interval '30 days', interval '1 day') d,
     generate_series(1, 5) n
WHERE extract(isodow FROM d) < 6 AND random() > 0.15;

INSERT INTO "Intervention" (id, reference, type, priority, status, "scheduledStart", "scheduledEnd", "visitNumber",
                            report, "companyId", "siteId", "technicianId", "updatedAt")
SELECT 'bi' || lpad((row_number() OVER ())::text, 9, '0'),
       'BEN-' || lpad((row_number() OVER ())::text, 9, '0'),
       (ARRAY['Entretien chaudière gaz', 'Dépannage chaudière', 'Entretien pompe à chaleur', 'Contrôle VMC'])[1 + (r_misc * 4)::int % 4],
       (ARRAY['LOW', 'NORMAL', 'NORMAL', 'NORMAL', 'HIGH', 'URGENT'])[1 + (r_misc * 600)::int % 6]::"Priority",
       (CASE WHEN start_at > now() THEN 'PLANNED'
             WHEN r_status < 0.92 THEN 'DONE'
             WHEN r_status < 0.97 THEN 'CANCELLED'
             ELSE 'PLANNED' END)::"InterventionStatus",
       start_at, start_at + interval '75 minutes',
       CASE WHEN (r_misc * 1000)::int % 10 = 0 THEN 2 ELSE 1 END,
       CASE WHEN start_at <= now() AND r_status < 0.92 THEN 'Intervention réalisée, installation remise en service.' END,
       company_id,
       'bk' || lpad(i::text, 4, '0') || lpad((1 + (r_site * techs * 25)::int % (techs * 25))::text, 5, '0') || 's' || (1 + (r_site * 1000)::int % 2),
       tech_id, now()
FROM slot;

INSERT INTO "ChecklistItem" (id, label, position, checked, "interventionId")
SELECT i.id || 'c' || p, (ARRAY['Diagnostic', 'Contrôle des sécurités', 'Remise en service'])[p], p - 1, i.status = 'DONE', i.id
FROM "Intervention" i, generate_series(1, 3) p;

-- Historique des statuts, cohérent avec le créneau (mêmes règles que prisma/seed.ts)
CREATE TEMP TABLE done AS
SELECT id, "technicianId" AS tech, "scheduledStart" + make_interval(mins => (-10 + random() * 35)::int) AS arrival,
       (15 + random() * 25)::int AS travel, (60 + random() * 45)::int AS on_site
FROM "Intervention" WHERE status = 'DONE';

INSERT INTO "StatusEvent" (id, status, at, "interventionId", "authorId")
SELECT id || 'e1', 'EN_ROUTE'::"InterventionStatus", arrival - make_interval(mins => travel), id, tech FROM done
UNION ALL SELECT id || 'e2', 'ON_SITE'::"InterventionStatus", arrival, id, tech FROM done
UNION ALL SELECT id || 'e3', 'DONE'::"InterventionStatus", arrival + make_interval(mins => on_site), id, tech FROM done
UNION ALL SELECT i.id || 'e0', 'CANCELLED'::"InterventionStatus", i."scheduledStart" - interval '2 hours', i.id, 'bm' || substr(i."companyId", 3)
          FROM "Intervention" i WHERE i.status = 'CANCELLED';

VACUUM ANALYZE;

SELECT (SELECT count(*) FROM "Company") AS entreprises, (SELECT count(*) FROM "User") AS utilisateurs,
       (SELECT count(*) FROM "Site") AS sites, (SELECT count(*) FROM "Intervention") AS interventions,
       (SELECT count(*) FROM "StatusEvent") AS evenements, (SELECT count(*) FROM "ChecklistItem") AS checklist,
       (SELECT count(*) FROM "Intervention" WHERE "companyId" = 'bc0001') AS interventions_entreprise_1,
       pg_size_pretty(pg_database_size(current_database())) AS taille;
