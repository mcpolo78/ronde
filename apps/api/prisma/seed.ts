/**
 * Données de démo réalistes : une PME de maintenance en Île-de-France,
 * 1 manager, 6 techniciens, ~30 clients et 5 semaines d'interventions
 * (3 passées avec historique complet, la semaine en cours, 1 à venir).
 * Déterministe (seed faker fixe) pour des démos et des tests reproductibles.
 */
import { fakerFR as faker } from "@faker-js/faker";
import { PrismaPg } from "@prisma/adapter-pg";
import { buildSignatureSvg, dayKey, zonedDateTime, type SignatureStrokes } from "@ronde/domain";
import { hashPassword } from "better-auth/crypto";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import type { InterventionStatus, Prisma, Priority } from "../src/generated/prisma/client";
import { PrismaClient } from "../src/generated/prisma/client";

faker.seed(42);

/** Mot de passe commun aux comptes de démo (affiché sur la page de connexion). */
export const DEMO_PASSWORD = "demo-ronde";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const INTERVENTION_TYPES = [
  { type: "Entretien chaudière gaz", minutes: 60, checklist: ["Contrôle combustion", "Nettoyage brûleur", "Test sécurités", "Attestation d'entretien"] },
  { type: "Dépannage chaudière", minutes: 90, checklist: ["Diagnostic", "Remplacement pièce", "Remise en service"] },
  { type: "Entretien pompe à chaleur", minutes: 75, checklist: ["Contrôle fluide", "Nettoyage filtres", "Relevé des pressions"] },
  { type: "Installation borne de recharge", minutes: 180, checklist: ["Vérification tableau électrique", "Pose de la borne", "Test de charge", "Explication au client"] },
  { type: "Contrôle VMC", minutes: 45, checklist: ["Mesure des débits", "Nettoyage bouches"] },
];

const CITIES = [
  { city: "Paris", postalCode: "75011", lat: 48.859, lng: 2.38 },
  { city: "Paris", postalCode: "75015", lat: 48.841, lng: 2.3 },
  { city: "Boulogne-Billancourt", postalCode: "92100", lat: 48.835, lng: 2.24 },
  { city: "Montreuil", postalCode: "93100", lat: 48.861, lng: 2.443 },
  { city: "Vincennes", postalCode: "94300", lat: 48.847, lng: 2.439 },
  { city: "Saint-Denis", postalCode: "93200", lat: 48.936, lng: 2.357 },
  { city: "Issy-les-Moulineaux", postalCode: "92130", lat: 48.823, lng: 2.27 },
  { city: "Nanterre", postalCode: "92000", lat: 48.892, lng: 2.207 },
];

const minutes = (n: number) => n * 60_000;

/** Identifiant au même format que ceux de Prisma (minuscules et chiffres, sans tiret). */
const newId = () => `c${randomUUID().replaceAll("-", "").slice(0, 24)}`;

async function insertInBatches<T>(insert: (data: T[]) => Promise<unknown>, data: T[], size = 1000) {
  for (let i = 0; i < data.length; i += size) await insert(data.slice(i, i + size));
}

/** Signature manuscrite plausible : deux ou trois tracés ondulés de gauche à droite. */
function fakeSignature(): SignatureStrokes {
  const width = 320;
  const height = 120;
  const strokes: number[][] = [];
  let x = faker.number.int({ min: 20, max: 40 });
  for (let s = 0; s < faker.number.int({ min: 2, max: 3 }); s++) {
    const points: number[] = [];
    const length = faker.number.int({ min: 60, max: 110 });
    const amplitude = faker.number.int({ min: 12, max: 30 });
    const phase = faker.number.float({ min: 0, max: Math.PI });
    for (let t = 0; t <= length; t += 4) {
      points.push(x + t, 60 + Math.sin(t / 9 + phase) * amplitude + Math.cos(t / 23) * 8);
    }
    strokes.push(points);
    x += length + faker.number.int({ min: 6, max: 18 });
  }
  return { width, height, strokes };
}

/** Heure de Paris pour un jour donné, quel que soit le fuseau de la machine qui exécute le seed. */
function atTime(day: Date, hour: number, minute = 0) {
  const hhmm = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return zonedDateTime(dayKey(day), hhmm);
}

function mondayOf(d: Date) {
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - diff);
  return day;
}

async function main() {
  // Le seed efface toutes les données : sur une base distante, il faut le confirmer explicitement.
  const host = new URL(process.env.DATABASE_URL!.replace(/^prisma+/, "")).hostname;
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(host);
  if (!isLocal && process.env.RONDE_DEMO_SEED !== "true") {
    throw new Error(`Seed refusé sur ${host} : définissez RONDE_DEMO_SEED=true pour une base de démo.`);
  }

  console.log("Nettoyage…");
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.statusEvent.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.storedFile.deleteMany();
  await prisma.signature.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.intervention.deleteMany();
  await prisma.site.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  const company = await prisma.company.create({ data: { name: "Thermo Services IDF" } });

  const manager = await prisma.user.create({
    data: {
      email: "claire@ronde.demo",
      name: "Claire Martin",
      role: "MANAGER",
      companyId: company.id,
      emailVerified: true,
    },
  });

  const technicianNames = ["Karim Benali", "Julie Moreau", "Thomas Petit", "Sofia Rossi", "Mehdi Haddad", "Lucas Bernard"];
  const technicians = await Promise.all(
    technicianNames.map((name, i) =>
      prisma.user.create({
        data: {
          email: i === 0 ? "karim@ronde.demo" : `${faker.helpers.slugify(name.split(" ")[0]!.toLowerCase())}@ronde.demo`,
          name,
          role: "TECHNICIAN",
          phone: faker.phone.number({ style: "national" }),
          companyId: company.id,
          emailVerified: true,
        },
      }),
    ),
  );

  // Identifiants Better Auth : un compte « credential » par utilisateur (accountId = userId)
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  await prisma.account.createMany({
    data: [manager, ...technicians].map((u) => ({
      accountId: u.id,
      providerId: "credential",
      userId: u.id,
      password: passwordHash,
    })),
  });

  const sites = [];
  for (let i = 0; i < 30; i++) {
    const isBusiness = faker.datatype.boolean({ probability: 0.4 });
    const place = faker.helpers.arrayElement(CITIES);
    const customer = await prisma.customer.create({
      data: {
        name: isBusiness ? faker.company.name() : faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
        phone: faker.phone.number({ style: "national" }),
        companyId: company.id,
      },
    });
    const siteCount = isBusiness ? faker.number.int({ min: 1, max: 3 }) : 1;
    for (let s = 0; s < siteCount; s++) {
      sites.push(
        await prisma.site.create({
          data: {
            label: isBusiness ? `Site ${s + 1}` : "Domicile",
            address: faker.location.streetAddress(),
            city: place.city,
            postalCode: place.postalCode,
            latitude: place.lat + faker.number.float({ min: -0.015, max: 0.015 }),
            longitude: place.lng + faker.number.float({ min: -0.02, max: 0.02 }),
            accessNotes: faker.helpers.maybe(
              () => faker.helpers.arrayElement(["Digicode 4512B", "Gardien au rez-de-chaussée", "Chaufferie au sous-sol, clé chez le gardien", "Sonner deux fois"]),
              { probability: 0.5 },
            ) ?? null,
            customerId: customer.id,
          },
        }),
      );
    }
  }

  const now = new Date();
  const firstMonday = mondayOf(new Date(now.getTime() - 21 * 86_400_000));
  let refCounter = 0;
  // Tout est préparé en mémoire puis inséré par lots : quelques allers-retours au lieu de milliers
  // (le seed nocturne tourne aux États-Unis contre une base à Francfort).
  const rows = {
    interventions: [] as Prisma.InterventionCreateManyInput[],
    checklist: [] as Prisma.ChecklistItemCreateManyInput[],
    events: [] as Prisma.StatusEventCreateManyInput[],
    files: [] as Prisma.StoredFileCreateManyInput[],
    signatures: [] as Prisma.SignatureCreateManyInput[],
  };

  for (let dayOffset = 0; dayOffset < 35; dayOffset++) {
    const day = new Date(firstMonday);
    day.setDate(day.getDate() + dayOffset);
    if (day.getDay() === 0 || day.getDay() === 6) continue;

    for (const tech of technicians) {
      let cursor = atTime(day, 8, faker.helpers.arrayElement([0, 15, 30]));
      const perDay = faker.number.int({ min: 2, max: 4 });

      for (let n = 0; n < perDay; n++) {
        const template = faker.helpers.arrayElement(INTERVENTION_TYPES);
        const scheduledStart = cursor;
        const scheduledEnd = new Date(scheduledStart.getTime() + minutes(template.minutes));
        cursor = new Date(scheduledEnd.getTime() + minutes(faker.helpers.arrayElement([30, 45, 60])));
        if (cursor >= atTime(day, 18)) break;

        const isPast = scheduledEnd < now;
        const isCurrent = scheduledStart <= now && now < scheduledEnd;
        let status: InterventionStatus = "PLANNED";
        if (isPast) status = faker.datatype.boolean({ probability: 0.95 }) ? "DONE" : "CANCELLED";
        else if (isCurrent) status = "ON_SITE";
        else if (scheduledStart.getTime() - now.getTime() < minutes(45)) status = "EN_ROUTE";

        const priority: Priority = faker.helpers.weightedArrayElement([
          { value: "LOW", weight: 2 },
          { value: "NORMAL", weight: 6 },
          { value: "HIGH", weight: 2 },
          { value: "URGENT", weight: 1 },
        ]);

        refCounter++;
        const intervention = { id: newId() };
        rows.interventions.push({
            id: intervention.id,
            reference: `INT-${scheduledStart.getFullYear()}-${String(refCounter).padStart(4, "0")}`,
            type: template.type,
            description: faker.helpers.maybe(() => faker.lorem.sentence({ min: 6, max: 14 }), { probability: 0.6 }) ?? null,
            priority,
            status,
            scheduledStart,
            scheduledEnd,
            visitNumber: faker.helpers.weightedArrayElement([{ value: 1, weight: 9 }, { value: 2, weight: 1 }]),
            report: status === "DONE" ? faker.lorem.sentences({ min: 1, max: 2 }) : null,
            companyId: company.id,
            siteId: faker.helpers.arrayElement(sites).id,
            technicianId: tech.id,
        });
        rows.checklist.push(
          ...template.checklist.map((label, position) => ({
            label,
            position,
            checked: status === "DONE",
            interventionId: intervention.id,
          })),
        );

        // Historique des statuts, cohérent avec le créneau (retards réalistes)
        const events: { status: InterventionStatus; at: Date; authorId: string }[] = [];
        if (status === "CANCELLED") {
          events.push({ status: "CANCELLED", at: new Date(scheduledStart.getTime() - minutes(120)), authorId: manager.id });
        } else if (status !== "PLANNED") {
          const arrival = new Date(scheduledStart.getTime() + minutes(faker.number.int({ min: -10, max: 25 })));
          events.push({ status: "EN_ROUTE", at: new Date(arrival.getTime() - minutes(faker.number.int({ min: 15, max: 40 }))), authorId: tech.id });
          if (status === "ON_SITE" || status === "DONE") events.push({ status: "ON_SITE", at: arrival, authorId: tech.id });
          if (status === "DONE") {
            const doneAt = new Date(arrival.getTime() + minutes(template.minutes + faker.number.int({ min: -15, max: 30 })));
            events.push({ status: "DONE", at: doneAt, authorId: tech.id });
            // vraie signature, construite comme celles du mobile (tracés → SVG côté serveur)
            const svg = Buffer.from(buildSignatureSvg(fakeSignature()));
            const fileId = newId();
            rows.files.push({ id: fileId, clientId: `seed-sig-${intervention.id}`, companyId: company.id, contentType: "image/svg+xml", size: svg.byteLength, data: svg });
            rows.signatures.push({
              url: `/api/files/${fileId}`,
              signerName: faker.person.fullName(),
              signedAt: doneAt,
              interventionId: intervention.id,
            });
          }
        }
        rows.events.push(...events.map((e) => ({ ...e, interventionId: intervention.id })));
      }
    }
  }

  // ordre imposé par les clés étrangères
  await insertInBatches((data) => prisma.intervention.createMany({ data }), rows.interventions);
  await insertInBatches((data) => prisma.checklistItem.createMany({ data }), rows.checklist);
  await insertInBatches((data) => prisma.statusEvent.createMany({ data }), rows.events);
  await insertInBatches((data) => prisma.storedFile.createMany({ data }), rows.files, 100);
  await insertInBatches((data) => prisma.signature.createMany({ data }), rows.signatures);

  console.log(`OK : 1 entreprise, ${technicians.length} techniciens, ${sites.length} sites, ${rows.interventions.length} interventions.`);
  console.log(`Comptes de démo (mot de passe « ${DEMO_PASSWORD} ») : claire@ronde.demo (manager), karim@ronde.demo (technicien)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
