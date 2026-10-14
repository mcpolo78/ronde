import { dayKey } from "@ronde/domain";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/ui";
import { gql } from "@/lib/api";
import { NewInterventionFormQuery } from "@/lib/queries";
import { NewInterventionForm } from "./new-intervention-form";
import { isManager } from "@/lib/viewer";

export const metadata: Metadata = { title: "Nouvelle intervention — Ronde" };

export default function NewInterventionPage() {
  return (
    <>
      <PageHeader title="Nouvelle intervention" description="Planifiez une intervention chez un client." />
      <Suspense fallback={<Skeleton className="h-[520px] max-w-3xl" />}>
        <Form />
      </Suspense>
    </>
  );
}

async function Form() {
  if (!(await isManager())) return null;
  await connection();
  const { sites, technicians } = await gql(NewInterventionFormQuery);

  // Regroupe les sites par client pour le <select>
  const customers = new Map<string, { name: string; sites: { id: string; label: string }[] }>();
  for (const site of sites) {
    const entry = customers.get(site.customer.id) ?? { name: site.customer.name, sites: [] };
    entry.sites.push({ id: site.id, label: `${site.label} — ${site.city}` });
    customers.set(site.customer.id, entry);
  }

  return (
      <NewInterventionForm
        customers={[...customers.values()]}
        technicians={technicians}
        today={dayKey(new Date())}
      />
  );
}
