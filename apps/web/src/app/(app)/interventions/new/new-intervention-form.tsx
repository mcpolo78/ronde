"use client";

import { useActionState } from "react";
import { Button, ButtonLink, Card, Field, inputClasses } from "@/components/ui";
import { PRIORITY_LABELS } from "@/components/ui";
import { createIntervention, type CreateFormState } from "../../actions";

const INTERVENTION_TYPES = [
  "Entretien chaudière gaz",
  "Dépannage chaudière",
  "Entretien pompe à chaleur",
  "Installation borne de recharge",
  "Contrôle VMC",
];

interface Props {
  customers: { name: string; sites: { id: string; label: string }[] }[];
  technicians: { id: string; name: string }[];
  today: string;
}

export function NewInterventionForm({ customers, technicians, today }: Props) {
  const [state, formAction, pending] = useActionState<CreateFormState, FormData>(createIntervention, {});
  const v = state.values ?? {};
  const err = state.fieldErrors ?? {};
  const a11y = (name: string) =>
    err[name] ? { "aria-invalid": true, "aria-describedby": `${name}-error` } : {};

  return (
    <form action={formAction} className="max-w-3xl">
      {state.formError && (
        <p role="alert" className="mb-4 rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
          {state.formError}
        </p>
      )}
      {/* React 19 réinitialise le formulaire après l'action : on remonte les champs
          avec les valeurs renvoyées par le serveur pour ne rien perdre de la saisie. */}
      <Card key={state.values ? JSON.stringify(state.values) : "initial"} className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Client et site" htmlFor="siteId" error={err.siteId}>
            <select id="siteId" name="siteId" required defaultValue={v.siteId ?? ""} className={inputClasses} {...a11y("siteId")}>
              <option value="" disabled>
                Choisir un site…
              </option>
              {customers.map((c) => (
                <optgroup key={c.name} label={c.name}>
                  {c.sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {c.name} · {s.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Type d'intervention" htmlFor="type" error={err.type}>
          <input
            id="type"
            name="type"
            list="intervention-types"
            required
            minLength={2}
            maxLength={80}
            defaultValue={v.type ?? ""}
            className={inputClasses}
            {...a11y("type")}
          />
          <datalist id="intervention-types">
            {INTERVENTION_TYPES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>

        <Field label="Priorité" htmlFor="priority">
          <select id="priority" name="priority" defaultValue={v.priority ?? "NORMAL"} className={inputClasses}>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Date" htmlFor="day" error={err.day}>
          <input id="day" name="day" type="date" required min={today} defaultValue={v.day ?? today} className={inputClasses} {...a11y("day")} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Début" htmlFor="startTime">
            <input id="startTime" name="startTime" type="time" required step={900} defaultValue={v.startTime ?? "09:00"} className={inputClasses} />
          </Field>
          <Field label="Fin" htmlFor="endTime" error={err.endTime}>
            <input id="endTime" name="endTime" type="time" required step={900} defaultValue={v.endTime ?? "10:00"} className={inputClasses} {...a11y("endTime")} />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="Technicien" htmlFor="technicianId" hint="Vous pourrez aussi l'assigner plus tard depuis le planning.">
            <select id="technicianId" name="technicianId" defaultValue={v.technicianId ?? ""} className={inputClasses}>
              <option value="">Non assignée</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="sm:col-span-2">
          <Field label="Description" htmlFor="description" hint="Symptômes, matériel concerné, informations utiles au technicien.">
            <textarea id="description" name="description" rows={4} maxLength={2000} defaultValue={v.description ?? ""} className={`${inputClasses} h-auto py-2`} />
          </Field>
        </div>
      </Card>
      <div className="mt-6 flex justify-end gap-2">
        <ButtonLink href="/interventions">Annuler</ButtonLink>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Création…" : "Créer l'intervention"}
        </Button>
      </div>
    </form>
  );
}
