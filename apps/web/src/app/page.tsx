import { INTERVENTION_STATUSES, STATUS_LABELS } from "@ronde/domain";

// Page provisoire (S1) : vérifie que le web consomme bien la logique métier partagée.
// Remplacée en S2 par le tableau de bord du back-office.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">Ronde</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        Back-office de planification des interventions terrain — en construction.
      </p>
      <ul className="flex flex-wrap gap-2" aria-label="Statuts d'une intervention">
        {INTERVENTION_STATUSES.map((status) => (
          <li
            key={status}
            className="rounded-full border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
          >
            {STATUS_LABELS[status]}
          </li>
        ))}
      </ul>
    </main>
  );
}
