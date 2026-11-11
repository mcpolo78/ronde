// Banc de charge sans dépendance : rejoue les requêtes GraphQL du back-office et de l'app mobile
// contre une API locale, à concurrence fixe, et affiche p50 / p95 / p99 par scénario.
//   node bench/load.mjs [--url http://localhost:4000/graphql] [--duration 20] [--concurrency 16] [--only nom] [--json fichier]
// L'API doit tourner avec ALLOW_DEV_IMPERSONATION=true sur la base remplie par bench/seed.sql.
import { writeFileSync } from "node:fs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const URL_ = arg("url", "http://localhost:4000/graphql");
const DURATION = Number(arg("duration", 20)) * 1000;
const CONCURRENCY = Number(arg("concurrency", 16));
const ONLY = arg("only", null);
const JSON_OUT = arg("json", null);

const MANAGER = "manager1@bench.ronde"; // entreprise n° 1 : 40 techniciens
const TECH = "tech1-7@bench.ronde";
const DAY = 86_400_000;
const midnight = new Date(new Date().setUTCHours(0, 0, 0, 0)).getTime();
const iso = (t) => new Date(t).toISOString();
const pick = (n) => Math.floor(Math.random() * n);

const ROW = `id reference type status priority scheduledStart scheduledEnd
  technician { id name } site { id label city latitude longitude customer { id name } }`;

/** Chaque scénario reprend une requête réelle de apps/web/src/lib/queries.ts ou de l'app mobile. */
const scenarios = {
  "tableau de bord (30 j)": {
    user: MANAGER,
    query: `query($from: DateTime!, $to: DateTime!, $tf: DateTime!, $tt: DateTime!) {
      dashboard(from: $from, to: $to) { total done inProgress avgOnSiteMinutes avgArrivalDelayMinutes firstTimeFixRate }
      today: interventions(from: $tf, to: $tt) { ${ROW} }
      technicians { id name } }`,
    variables: () => ({ from: iso(midnight - 30 * DAY), to: iso(midnight + DAY), tf: iso(midnight), tt: iso(midnight + DAY) }),
  },
  "indicateurs seuls (30 j)": {
    user: MANAGER,
    query: `query($from: DateTime!, $to: DateTime!) {
      dashboard(from: $from, to: $to) { total done inProgress avgOnSiteMinutes avgArrivalDelayMinutes firstTimeFixRate } }`,
    variables: () => ({ from: iso(midnight - 30 * DAY), to: iso(midnight + DAY) }),
  },
  "indicateurs seuls (365 j)": {
    user: MANAGER,
    query: `query($from: DateTime!, $to: DateTime!) {
      dashboard(from: $from, to: $to) { total done inProgress avgOnSiteMinutes avgArrivalDelayMinutes firstTimeFixRate } }`,
    variables: () => ({ from: iso(midnight - 365 * DAY), to: iso(midnight + DAY) }),
  },
  "planning (1 semaine)": {
    user: MANAGER,
    query: `query($from: DateTime!, $to: DateTime!) { interventions(from: $from, to: $to) { ${ROW} } technicians { id name } }`,
    variables: () => {
      const from = midnight - (7 + pick(90)) * DAY;
      return { from: iso(from), to: iso(from + 7 * DAY) };
    },
  },
  "liste filtrée (1 technicien, 30 j)": {
    user: MANAGER,
    query: `query($from: DateTime!, $to: DateTime!, $t: ID) {
      interventions(from: $from, to: $to, technicianId: $t, status: [DONE]) { ${ROW} } }`,
    variables: () => ({ from: iso(midnight - 30 * DAY), to: iso(midnight), t: `bt0001${String(1 + pick(40)).padStart(3, "0")}` }),
  },
  "détail d'une intervention": {
    user: MANAGER,
    setup: async () => (await gql(MANAGER, `query($f: DateTime!, $t: DateTime!) { interventions(from: $f, to: $t) { id } }`,
      { f: iso(midnight - 20 * DAY), t: iso(midnight - 10 * DAY) })).data.interventions.map((i) => i.id),
    query: `query($id: ID!) { intervention(id: $id) { id reference type description status priority visitNumber report
      scheduledStart scheduledEnd technician { id name phone }
      site { id label address postalCode city accessNotes customer { id name email phone } }
      checklist { id label checked } photos { id url caption } signature { signerName signedAt url }
      events { id status at author { name } } } }`,
    variables: (ids) => ({ id: ids[pick(ids.length)] }),
  },
  "formulaire (sites + techniciens)": {
    user: MANAGER,
    query: `{ sites { id label city customer { id name } } technicians { id name } }`,
    variables: () => ({}),
  },
  "ma journée (mobile)": {
    user: TECH,
    query: `query($d: DateTime) { myDay(date: $d) { ${ROW} checklist { id label checked } } }`,
    variables: () => ({ d: iso(midnight - pick(60) * DAY + 10 * 3_600_000) }),
  },
  "création d'intervention": {
    user: MANAGER,
    write: true,
    query: `mutation($input: CreateInterventionInput!) { createIntervention(input: $input) { id reference } }`,
    variables: () => {
      const start = midnight + (40 + pick(200)) * DAY + 9 * 3_600_000;
      return { input: { siteId: `bk0001${String(1 + pick(1000)).padStart(5, "0")}s1`, type: "Contrôle VMC",
        scheduledStart: iso(start), scheduledEnd: iso(start + 3_600_000) } };
    },
  },
};

async function gql(user, query, variables) {
  const res = await fetch(URL_, {
    method: "POST",
    headers: { "content-type": "application/json", "x-dev-user": user },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];

async function run(name, s) {
  const ctx = s.setup ? await s.setup() : null;
  for (let i = 0; i < 5; i++) await gql(s.user, s.query, s.variables(ctx)); // mise en température
  const times = [];
  const errors = {};
  const end = performance.now() + DURATION;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (performance.now() < end) {
      const t0 = performance.now();
      const body = await gql(s.user, s.query, s.variables(ctx));
      times.push(performance.now() - t0);
      if (body.errors) {
        const msg = body.errors[0].message.slice(0, 80);
        errors[msg] = (errors[msg] ?? 0) + 1;
      }
    }
  }));
  times.sort((a, b) => a - b);
  const r = (n) => Math.round(n * 10) / 10;
  return { scenario: name, requetes: times.length, "req/s": r(times.length / (DURATION / 1000)),
    p50: r(quantile(times, 0.5)), p95: r(quantile(times, 0.95)), p99: r(quantile(times, 0.99)),
    erreurs: Object.values(errors).reduce((a, b) => a + b, 0), detailErreurs: errors };
}

const results = [];
for (const [name, s] of Object.entries(scenarios)) {
  if (ONLY && !name.includes(ONLY)) continue;
  const r = await run(name, s);
  results.push(r);
  const { detailErreurs, ...row } = r;
  console.log(JSON.stringify(row), Object.keys(detailErreurs).length ? detailErreurs : "");
}
console.table(results.map(({ detailErreurs, ...row }) => row));
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ date: new Date().toISOString(), concurrency: CONCURRENCY, durationSeconds: DURATION / 1000, results }, null, 2));
