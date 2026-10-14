"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { dayKey, moveToDay } from "@ronde/domain";
import clsx from "clsx";
import { GripVertical, MoveRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Button, inputClasses, StatusBadge } from "@/components/ui";
import { formatShortDay, formatTimeRange } from "@/lib/format";
import type { InterventionRow } from "@/lib/queries";
import { scheduleIntervention } from "../actions";

const UNASSIGNED = "none";

interface Props {
  days: string[];
  today: string;
  technicians: { id: string; name: string }[];
  interventions: InterventionRow[];
}

interface Move {
  id: string;
  technicianId: string | null;
  day: string;
}

/** Seules les interventions pas encore commencées peuvent être déplacées. */
const isMovable = (i: InterventionRow) => i.status === "PLANNED";

function applyMove(list: InterventionRow[], move: Move): InterventionRow[] {
  return list.map((i) => {
    if (i.id !== move.id) return i;
    const { from, to } = moveToDay(new Date(i.scheduledStart), new Date(i.scheduledEnd), move.day);
    return {
      ...i,
      scheduledStart: from.toISOString(),
      scheduledEnd: to.toISOString(),
      technician: move.technicianId ? { id: move.technicianId, name: "" } : null,
    };
  });
}

export function PlanningBoard({ days, today, technicians, interventions }: Props) {
  const [optimistic, addOptimistic] = useOptimistic(interventions, applyMove);
  const [, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [dragging, setDragging] = useState<InterventionRow | null>(null);
  const [moving, setMoving] = useState<InterventionRow | null>(null);

  const rows = [...technicians.map((t) => ({ id: t.id, name: t.name })), { id: UNASSIGNED, name: "Non assignées" }];
  const rowName = (id: string) => rows.find((r) => r.id === id)?.name ?? "";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function commit(move: Move) {
    const current = optimistic.find((i) => i.id === move.id);
    if (!current) return;
    const sameDay = dayKey(current.scheduledStart) === move.day;
    const sameTech = (current.technician?.id ?? null) === move.technicianId;
    if (sameDay && sameTech) return;

    const { from, to } = moveToDay(new Date(current.scheduledStart), new Date(current.scheduledEnd), move.day);
    setMessage(null);
    startTransition(async () => {
      addOptimistic(move); // affichage immédiat ; annulé automatiquement si l'action échoue
      const result = await scheduleIntervention({
        id: move.id,
        scheduledStart: from.toISOString(),
        scheduledEnd: to.toISOString(),
        technicianId: move.technicianId,
      });
      setMessage(
        result.ok
          ? { tone: "info", text: `${current.reference} déplacée : ${rowName(move.technicianId ?? UNASSIGNED)}, ${formatShortDay(from)}.` }
          : { tone: "error", text: result.message },
      );
    });
  }

  function onDragStart(event: DragStartEvent) {
    setDragging(optimistic.find((i) => i.id === event.active.id) ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    setDragging(null);
    if (!event.over) return;
    const [technicianId, day] = String(event.over.id).split("::") as [string, string];
    commit({ id: String(event.active.id), technicianId: technicianId === UNASSIGNED ? null : technicianId, day });
  }

  const describe = (id: string | number) => {
    const i = optimistic.find((x) => x.id === id);
    return i ? `${i.reference}, ${i.type}` : "intervention";
  };
  const describeCell = (id: string | number) => {
    const [tech, day] = String(id).split("::") as [string, string];
    return `${rowName(tech)}, ${formatShortDay(day)}`;
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${describe(active.id)} saisie.`,
    onDragOver: ({ active, over }) =>
      over ? `${describe(active.id)} au-dessus de ${describeCell(over.id)}.` : `${describe(active.id)} hors du planning.`,
    onDragEnd: ({ active, over }) =>
      over ? `${describe(active.id)} déposée sur ${describeCell(over.id)}.` : `${describe(active.id)} relâchée, aucun changement.`,
    onDragCancel: ({ active }) => `Déplacement de ${describe(active.id)} annulé.`,
  };

  return (
    <>
      <div aria-live="polite" className="min-h-6 text-sm">
        {message && (
          <p className={message.tone === "error" ? "text-danger" : "text-muted"} role={message.tone === "error" ? "alert" : undefined}>
            {message.text}
          </p>
        )}
      </div>

      <DndContext
        id="planning-board" // identifiants stables entre rendu serveur et client (hydratation)
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "Pour déplacer une intervention, appuyez sur Espace, utilisez les flèches puis Espace pour déposer, ou Échap pour annuler. Vous pouvez aussi utiliser le bouton Déplacer.",
          },
        }}
      >
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <div role="table" aria-label="Planning de la semaine" className="grid min-w-[980px]" style={{ gridTemplateColumns: `160px repeat(${days.length}, minmax(0, 1fr))` }}>
            <div role="row" className="contents">
              <div role="columnheader" className="sticky left-0 border-b border-border bg-surface px-3 py-2 text-xs text-muted">
                Technicien
              </div>
              {days.map((day) => (
                <div
                  role="columnheader"
                  key={day}
                  className={clsx("border-b border-l border-border px-3 py-2 text-xs font-medium first-letter:uppercase", day === today && "bg-brand-soft text-brand-strong")}
                >
                  {formatShortDay(day)}
                  {day === today && <span className="sr-only"> (aujourd&apos;hui)</span>}
                </div>
              ))}
            </div>

            {rows.map((row) => (
              <div role="row" key={row.id} className="contents">
                <div role="rowheader" className={clsx("sticky left-0 border-b border-border bg-surface px-3 py-3 text-sm font-medium", row.id === UNASSIGNED && "text-danger")}>
                  {row.name}
                </div>
                {days.map((day) => (
                  <Cell
                    key={day}
                    id={`${row.id}::${day}`}
                    isToday={day === today}
                    items={optimistic.filter(
                      (i) => (i.technician?.id ?? UNASSIGNED) === row.id && dayKey(i.scheduledStart) === day,
                    )}
                    onMove={setMoving}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>{dragging && <CardBody intervention={dragging} lifted />}</DragOverlay>
      </DndContext>

      <MoveDialog
        intervention={moving}
        days={days}
        rows={rows}
        onClose={() => setMoving(null)}
        onConfirm={(move) => {
          setMoving(null);
          commit(move);
        }}
      />
    </>
  );
}

function Cell({
  id,
  items,
  isToday,
  onMove,
}: {
  id: string;
  items: InterventionRow[];
  isToday: boolean;
  onMove: (i: InterventionRow) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      role="cell"
      ref={setNodeRef}
      className={clsx(
        "flex min-h-24 flex-col gap-1.5 border-b border-l border-border p-1.5 transition-colors",
        isToday && "bg-brand-soft/40",
        isOver && "bg-brand-soft ring-2 ring-brand ring-inset",
      )}
    >
      {items.map((i) => (
        <DraggableCard key={i.id} intervention={i} onMove={onMove} />
      ))}
    </div>
  );
}

function DraggableCard({ intervention, onMove }: { intervention: InterventionRow; onMove: (i: InterventionRow) => void }) {
  const movable = isMovable(intervention);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: intervention.id,
    disabled: !movable,
  });

  // La carte entière se saisit à la souris ou au doigt (écouteurs seuls, pas de rôle) ;
  // au clavier, c'est la poignée, un vrai bouton : aucun contrôle n'est imbriqué dans un autre.
  const handle = movable ? (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Glisser ${intervention.reference}`}
      className="-ml-1 flex size-6 shrink-0 cursor-grab items-center justify-center rounded text-muted hover:bg-surface-muted active:cursor-grabbing"
    >
      <GripVertical aria-hidden className="size-3.5" />
    </button>
  ) : null;

  return (
    <div
      ref={setNodeRef}
      {...(movable ? listeners : {})}
      className={clsx("group relative", movable && "cursor-grab touch-none active:cursor-grabbing", isDragging && "opacity-40")}
      title={movable ? "Glisser pour déplacer" : "Intervention commencée ou clôturée : non déplaçable"}
    >
      <CardBody intervention={intervention} handle={handle} />
      {movable && (
        <button
          type="button"
          onClick={() => onMove(intervention)}
          className="absolute top-1 right-1 flex size-6 items-center justify-center rounded bg-surface text-muted opacity-0 shadow-xs group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
          aria-label={`Déplacer ${intervention.reference}`}
        >
          <MoveRight aria-hidden className="size-4" />
        </button>
      )}
    </div>
  );
}

const BORDER: Record<InterventionRow["status"], string> = {
  PLANNED: "border-l-[var(--status-planned)]",
  EN_ROUTE: "border-l-[var(--status-en-route)]",
  ON_SITE: "border-l-[var(--status-on-site)]",
  DONE: "border-l-[var(--status-done)]",
  CANCELLED: "border-l-[var(--status-cancelled)]",
};

function CardBody({
  intervention: i,
  lifted,
  handle,
}: {
  intervention: InterventionRow;
  lifted?: boolean;
  handle?: React.ReactNode;
}) {
  const cancelled = i.status === "CANCELLED";
  return (
    <div
      className={clsx(
        "rounded-md border border-l-4 border-border bg-surface px-2 py-1.5 text-xs",
        BORDER[i.status],
        // annulée : fond atténué et texte barré, mais contrastes intacts (pas d'opacité)
        cancelled && "border-dashed bg-surface-muted",
        lifted && "rotate-1 shadow-lg",
        (i.priority === "URGENT" || i.priority === "HIGH") && "ring-1 ring-danger/50",
      )}
    >
      <p className="flex min-h-6 items-center gap-1 font-medium tabular-nums">
        {handle ?? (lifted && <GripVertical aria-hidden className="-ml-1 size-3.5 text-muted" />)}
        {formatTimeRange(i.scheduledStart, i.scheduledEnd)}
      </p>
      <Link
        href={`/interventions/${i.id}`}
        className={clsx("block truncate hover:underline", cancelled && "line-through")}
        draggable={false}
      >
        {i.type}
      </Link>
      <p className="truncate text-muted">
        {i.site.customer.name} · {i.site.city}
      </p>
      {i.status !== "PLANNED" && <StatusBadge status={i.status} className="mt-1" />}
    </div>
  );
}

/** Alternative accessible au glisser-déposer : choisir le technicien et le jour dans une liste. */
function MoveDialog({
  intervention,
  days,
  rows,
  onClose,
  onConfirm,
}: {
  intervention: InterventionRow | null;
  days: string[];
  rows: { id: string; name: string }[];
  onClose: () => void;
  onConfirm: (move: Move) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (intervention && !dialog?.open) dialog?.showModal();
    if (!intervention && dialog?.open) dialog.close();
  }, [intervention]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="move-title"
      className="m-auto w-full max-w-sm rounded-xl border border-border bg-surface p-6 text-foreground shadow-xl backdrop:bg-black/40"
    >
      {intervention && (
        <form
          key={intervention.id}
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const tech = String(data.get("technician"));
            onConfirm({ id: intervention.id, technicianId: tech === UNASSIGNED ? null : tech, day: String(data.get("day")) });
          }}
          className="flex flex-col gap-4"
        >
          <h2 id="move-title" className="font-semibold">
            Déplacer {intervention.reference}
          </h2>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Technicien
            <select name="technician" defaultValue={intervention.technician?.id ?? UNASSIGNED} className={inputClasses}>
              {rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Jour (même horaire)
            <select name="day" defaultValue={dayKey(intervention.scheduledStart)} className={inputClasses}>
              {days.map((d) => (
                <option key={d} value={d} className="capitalize">
                  {formatShortDay(d)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" onClick={() => ref.current?.close()}>
              Annuler
            </Button>
            <Button type="submit" size="sm" variant="primary">
              Déplacer
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
}
