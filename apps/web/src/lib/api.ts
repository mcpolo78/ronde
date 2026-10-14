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

/**
 * Exécute une opération GraphQL côté serveur (Server Components, Server Actions)
 * en relayant le cookie de session du navigateur vers l'API.
 * Une session absente ou expirée renvoie vers la page de connexion.
 */
export async function gql<Result, Variables>(
  document: TadaDocumentNode<Result, Variables>,
  variables?: Variables,
): Promise<Result> {
  const cookieHeader = (await cookies()).toString();
  const response = await fetch(`${API_URL}/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieHeader },
    body: JSON.stringify({ query: print(document), variables }),
    cache: "no-store",
  });

  let body: { data?: Result; errors?: ApiErrorShape[] };
  try {
    body = await response.json();
  } catch {
    throw new ApiError(`API indisponible (HTTP ${response.status})`, "API_UNAVAILABLE", []);
  }
  if (body.errors?.length) {
    const first = body.errors[0]!;
    const code = first.extensions?.code;
    if (code === "UNAUTHENTICATED") redirect("/login");
    throw new ApiError(first.message, code, body.errors);
  }
  return body.data as Result;
}
