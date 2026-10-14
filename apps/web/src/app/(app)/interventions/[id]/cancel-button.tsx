"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { cancelIntervention } from "../../actions";

export function CancelButton({ id, reference }: { id: string; reference: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => dialog.current?.showModal()}>
        Annuler l&apos;intervention
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby="cancel-title"
        className="m-auto w-full max-w-sm rounded-xl border border-border bg-surface p-6 text-foreground shadow-xl backdrop:bg-black/40"
      >
        <h2 id="cancel-title" className="font-semibold">
          Annuler {reference} ?
        </h2>
        <p className="mt-2 text-sm text-muted">
          Le technicien sera prévenu et l&apos;intervention ne pourra plus être modifiée.
        </p>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button size="sm" onClick={() => dialog.current?.close()} disabled={pending}>
            Retour
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await cancelIntervention(id);
                if (result.ok) dialog.current?.close();
                else setError(result.message);
              })
            }
          >
            {pending ? "Annulation…" : "Confirmer l'annulation"}
          </Button>
        </div>
      </dialog>
    </>
  );
}
