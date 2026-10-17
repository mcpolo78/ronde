import "server-only";
import type { TadaDocumentNode } from "@ronde/graphql";
import { print } from "graphql";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

export interface ApiErrorShape {
  message: string;
  extensions?: { code?: string; [key: string]: unknown };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
    readonly errors: ApiErrorShape[],
  ) {
    super(message);
  }
}

/** Délai maximal d'une tentative : l'API gratuite peut mettre longtemps à se réveiller. */
const ATTEMPT_TIMEOUT_MS = 20_000;
/** Attentes entre deux essais de lecture (3 tentatives au total). */
const RETRY_DELAYS_MS = [2_000, 5_000];

/** Une requête de lecture (`query`) peut être rejouée sans risque ; une mutation non. */
const isQuery = (text: string) => /^s*(query|{)/.test(text);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Exécute une opération GraphQL côté serveur (Server Components, Server Actions)
 * en relayant le cookie de session du navigateur vers l'API.
 * Une session absente ou expirée renvoie vers la page de connexion.
 * Une lecture qui échoue par indisponibilité (réveil de l'API, base en veille) est rejouée
 * avec une attente croissante ; une mutation n'est jamais rejouée.
 */
export async function gql<Result, Variables>(
  document: TadaDocumentNode<Result, Variables>,
  variables?: Variables,
): Promise<Result> {
  const cookieHeader = (await cookies()).toString();
  const query = print(document);
  const delays = isQuery(query) ? RETRY_DELAYS_MS : [];

  for (let attempt = 0; ; attempt++) {
    const outcome = await send(query, variables, cookieHeader);
    if (outcome.kind === "ok") return outcome.data as Result;
    if (outcome.kind === "error") throw outcome.error;
    if (attempt >= delays.length) {
      throw new ApiError("Le service démarre, réessayez dans un instant.", "API_UNAVAILABLE", []);
    }
    await wait(delays[attempt]!);
  }
}

type Outcome =
  | { kind: "ok"; data: unknown }
  | { kind: "error"; error: ApiError }
  | { kind: "unavailable" };

async function send<Result, Variables>(
  query: string,
  variables: Variables | undefined,
  cookieHeader: string,
): Promise<Outcome> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/graphql`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookieHeader },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    });
  } catch {
    return { kind: "unavailable" };
  }

  if (response.status >= 500) return { kind: "unavailable" };

  let body: { data?: Result; errors?: ApiErrorShape[] };
  try {
    body = await response.json();
  } catch {
    return { kind: "unavailable" };
  }

  if (body.errors?.length) {
    const first = body.errors[0]!;
    const code = first.extensions?.code;
    if (code === "UNAUTHENTICATED") redirect("/login");
    if (code === "INTERNAL_SERVER_ERROR") return { kind: "unavailable" };
    return { kind: "error", error: new ApiError(first.message, code, body.errors) };
  }
  return { kind: "ok", data: body.data as Result };
}
