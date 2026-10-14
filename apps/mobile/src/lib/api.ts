import type { TadaDocumentNode } from "@ronde/graphql";
import { print } from "graphql";
import { Platform } from "react-native";
import { authClient } from "./auth-client";
import { API_URL } from "./config";

/** Le serveur n'est pas joignable (hors ligne, API en veille…) : l'opération sera rejouée. */
export class NetworkError extends Error {}

/** Le serveur a répondu mais refuse l'opération (règle métier, droits…). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
  ) {
    super(message);
  }
}

export async function authHeaders(): Promise<Record<string, string>> {
  if (Platform.OS === "web") return {};
  const cookie = await authClient.getCookie();
  return cookie ? { Cookie: cookie } : {};
}

async function request(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, {
      ...init,
      credentials: Platform.OS === "web" ? "include" : "omit",
      headers: { ...(await authHeaders()), ...init.headers },
    });
  } catch (error) {
    throw new NetworkError(error instanceof Error ? error.message : "Réseau indisponible");
  }
}

export async function gql<Result, Variables>(
  document: TadaDocumentNode<Result, Variables>,
  variables?: Variables,
): Promise<Result> {
  const response = await request(`${API_URL}/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: print(document), variables }),
  });
  if (response.status >= 500) throw new NetworkError(`API indisponible (${response.status})`);
  const body = (await response.json()) as {
    data?: Result;
    errors?: { message: string; extensions?: { code?: string } }[];
  };
  const error = body.errors?.[0];
  if (error) throw new ApiError(error.message, error.extensions?.code);
  return body.data as Result;
}

/** Envoie une image (JPEG/PNG) ; `clientId` rend l'envoi idempotent. */
export async function uploadFile(localUri: string, clientId: string): Promise<{ id: string; url: string }> {
  let blob: Blob;
  try {
    blob = await (await fetch(localUri)).blob();
  } catch {
    throw new ApiError("Photo introuvable sur l'appareil", "LOCAL_FILE_MISSING");
  }
  const response = await request(`${API_URL}/api/files`, {
    method: "POST",
    headers: { "x-client-id": clientId, "content-type": blob.type || "image/jpeg" },
    body: blob,
  });
  if (response.status >= 500) throw new NetworkError(`API indisponible (${response.status})`);
  const body = await response.json();
  if (!response.ok) throw new ApiError(body.error ?? "Envoi refusé", `HTTP_${response.status}`);
  return body;
}

/** URL absolue d'un fichier servi par l'API (photos, signatures déjà synchronisées). */
export const fileSource = async (path: string) =>
  path.startsWith("/") ? { uri: `${API_URL}${path}`, headers: await authHeaders() } : { uri: path };
