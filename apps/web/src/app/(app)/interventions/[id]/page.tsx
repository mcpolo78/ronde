import { dayKey, isTerminal, STATUS_LABELS } from "@ronde/domain";
import { CalendarRange, Check, MapPin, Phone, User } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { ButtonLink, Card, PageHeader, PriorityBadge, Skeleton, StatusBadge } from "@/components/ui";
import { gql } from "@/lib/api";
import { formatDateTime, formatLongDay, formatTime, formatTimeRange } from "@/lib/format";
import { InterventionDetailQuery } from "@/lib/queries";
import { CancelButton } from "./cancel-button";
import { isManager } from "@/lib/viewer";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
};

// Une seule requête pour les métadonnées et la page
const getIntervention = cache((id: string) => gql(InterventionDetailQuery, { id }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { intervention } = await getIntervention((await params).id);
  return { title: intervention ? `${intervention.reference} — Ronde` : "Intervention — Ronde" };
}

export default function InterventionPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Chargement de l'intervention">
          <Skeleton className="h-10 w-80" />
          <Skeleton className="h-96" />
        </div>
      }
    >
      <InterventionDetail {...props} />
    </Suspense>
  );
}

async function InterventionDetail({ params, searchParams }: Props) {
  if (!(await isManager())) return null;
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  const { intervention: i } = await getIntervention(id);
  if (!i) notFound();

  const mapsUrl = `https://www.openstreetmap.org/search?query=${encodeURIComponent(
    `${i.site.address}, ${i.site.postalCode} ${i.site.city}`,
  )}`;

  return (
    <>
      {created && (
        <p role="status" className="mb-4 rounded-lg border border-brand/30 bg-brand-soft px-4 py-3 text-sm text-brand-strong">
          Intervention {i.reference} créée.
        </p>
      )}
      <nav aria-label="Fil d'Ariane" className="mb-2 text-sm text-muted">
        <Link href="/interventions" className="hover:text-foreground">
          Interventions
        </Link>{" "}
        / <span className="font-mono">{i.reference}</span>
      </nav>
      <PageHeader
        title={i.type}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={i.status} />
            <PriorityBadge priority={i.priority} />
            {i.visitNumber > 1 && <span className="text-xs">Visite n° {i.visitNumber}</span>}
          </span>
        }
        actions={
          <>
            <ButtonLink href={`/planning?week=${dayKey(i.scheduledStart)}`} size="sm">
              <CalendarRange aria-hidden className="size-4" /> Voir dans le planning
            </ButtonLink>
            {!isTerminal(i.status) && <CancelButton id={i.id} reference={i.reference} />}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-4 font-semibold">Détails</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Info label="Créneau">
                <span className="first-letter:uppercase">{formatLongDay(i.scheduledStart)}</span>
                <br />
                {formatTimeRange(i.scheduledStart, i.scheduledEnd)}
              </Info>
              <Info label="Technicien">
                {i.technician ? (
                  <>
                    {i.technician.name}
                    {i.technician.phone && <span className="block text-muted">{i.technician.phone}</span>}
                  </>
                ) : (
                  <span className="text-danger">Non assignée</span>
                )}
              </Info>
              {i.description && (
                <div className="sm:col-span-2">
                  <Info label="Description">{i.description}</Info>
                </div>
              )}
              {i.report && (
                <div className="sm:col-span-2">
                  <Info label="Compte rendu du technicien">{i.report}</Info>
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">Checklist</h2>
            {i.checklist.length === 0 ? (
              <p className="text-sm text-muted">Pas de checklist pour ce type d&apos;intervention.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {i.checklist.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-sm">
                    <span
                      className={`flex size-5 items-center justify-center rounded border ${item.checked ? "border-brand bg-brand text-white dark:text-zinc-950" : "border-border"}`}
                    >
                      {item.checked && <Check aria-hidden className="size-3.5" />}
                    </span>
                    <span className={item.checked ? "" : "text-muted"}>{item.label}</span>
                    <span className="sr-only">{item.checked ? "(fait)" : "(à faire)"}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {(i.photos.length > 0 || i.signature) && (
            <Card>
              <h2 className="mb-3 font-semibold">Preuves de passage</h2>
              {i.signature && (
                <figure className="mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element -- images servies par le stockage de l'API */}
                  <img src={i.signature.url} alt={`Signature de ${i.signature.signerName}`} className="h-20 rounded border border-border bg-white" />
                  <figcaption className="mt-1 text-xs text-muted">
                    Signé par {i.signature.signerName} le {formatDateTime(i.signature.signedAt)}
                  </figcaption>
                </figure>
              )}
              {i.photos.length > 0 && (
                <ul className="grid grid-cols-3 gap-2">
                  {i.photos.map((photo) => (
                    <li key={photo.id}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- images servies par le stockage de l'API */}
                      <img src={photo.url} alt={photo.caption ?? "Photo d'intervention"} className="aspect-square rounded object-cover" />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-3 font-semibold">Client</h2>
            <p className="font-medium">{i.site.customer.name}</p>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              <li className="flex gap-2">
                <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                <span>
                  {i.site.label}
                  <br />
                  {i.site.address}, {i.site.postalCode} {i.site.city}
                  <br />
                  <a href={mapsUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                    Voir sur la carte
                  </a>
                </span>
              </li>
              {i.site.customer.phone && (
                <li className="flex gap-2">
                  <Phone aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                  <a href={`tel:${i.site.customer.phone.replace(/\s/g, "")}`} className="hover:underline">
                    {i.site.customer.phone}
                  </a>
                </li>
              )}
              {i.site.customer.email && (
                <li className="flex gap-2">
                  <User aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                  <a href={`mailto:${i.site.customer.email}`} className="truncate hover:underline">
                    {i.site.customer.email}
                  </a>
                </li>
              )}
            </ul>
            {i.site.accessNotes && (
              <p className="mt-3 rounded-lg bg-surface-muted px-3 py-2 text-sm">
                <span className="font-medium">Accès :</span> {i.site.accessNotes}
              </p>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">Historique</h2>
            {i.events.length === 0 ? (
              <p className="text-sm text-muted">Pas encore de changement de statut.</p>
            ) : (
              <ol className="relative flex flex-col gap-4 border-l border-border pl-4">
                {i.events.map((event) => (
                  <li key={event.id} className="text-sm">
                    <span aria-hidden className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2 border-surface bg-brand" />
                    <p className="font-medium">{STATUS_LABELS[event.status]}</p>
                    <p className="text-xs text-muted">
                      {formatTime(event.at)} · {event.author.name}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}
