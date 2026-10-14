import type { APIRequestContext } from "@playwright/test";

const API = "http://localhost:4000/graphql";

/** Appel GraphQL « en tant que » un utilisateur de démo (dev uniquement, voir context.ts de l'API). */
export async function asUser<T = any>(request: APIRequestContext, email: string, query: string, variables?: object): Promise<T> {
  const response = await request.post(API, {
    headers: { "x-dev-user": email, "content-type": "application/json" },
    data: { query, variables },
  });
  const body = await response.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data;
}

/** Crée une intervention pour Karim qui commence dans `inMinutes` minutes, avec une checklist. */
export async function createInterventionForKarim(request: APIRequestContext, type: string, inMinutes: number) {
  const { me } = await asUser(request, "karim@ronde.demo", "{ me { id } }");
  const { sites } = await asUser(request, "claire@ronde.demo", "{ sites { id } }");
  const start = new Date(Date.now() + inMinutes * 60_000);
  const end = new Date(start.getTime() + 60 * 60_000);
  const { createIntervention } = await asUser(
    request,
    "claire@ronde.demo",
    `mutation($input: CreateInterventionInput!) { createIntervention(input: $input) { id reference } }`,
    {
      input: {
        siteId: sites[0].id,
        type,
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
        technicianId: me.id,
      },
    },
  );
  return createIntervention as { id: string; reference: string };
}

export async function serverState(request: APIRequestContext, id: string) {
  const { intervention } = await asUser(
    request,
    "claire@ronde.demo",
    `query($id: ID!) { intervention(id: $id) {
      status report
      events { status }
      photos { url }
      signature { signerName url }
    } }`,
    { id },
  );
  return intervention;
}

export async function cancelAsManager(request: APIRequestContext, id: string) {
  await asUser(
    request,
    "claire@ronde.demo",
    `mutation($input: ChangeStatusInput!) { changeStatus(input: $input) { status } }`,
    { input: { interventionId: id, status: "CANCELLED", at: new Date().toISOString(), clientId: `cancel-${id}` } },
  );
}
