import type { IncomingMessage, ServerResponse } from "node:http";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth";
import { prisma } from "./db";

/**
 * Stockage des fichiers (photos d'intervention, signatures).
 * Implémentation en base pour la démo : l'interface permet de passer à un stockage objet
 * (S3, R2) sans toucher aux appelants.
 */
export interface FileStore {
  put(file: { clientId: string; companyId: string; contentType: string; data: Uint8Array }): Promise<{ id: string }>;
  get(id: string, companyId: string): Promise<{ contentType: string; data: Uint8Array } | null>;
}

export const dbFileStore: FileStore = {
  async put({ clientId, companyId, contentType, data }) {
    // Idempotent : un envoi rejoué (même clientId) renvoie le fichier déjà stocké.
    const existing = await prisma.storedFile.findUnique({ where: { clientId }, select: { id: true, companyId: true } });
    if (existing) {
      if (existing.companyId !== companyId) throw new HttpError(409, "Identifiant de fichier déjà utilisé");
      return { id: existing.id };
    }
    return prisma.storedFile.create({
      data: { clientId, companyId, contentType, size: data.byteLength, data: Buffer.from(data) },
      select: { id: true },
    });
  },
  async get(id, companyId) {
    const file = await prisma.storedFile.findFirst({ where: { id, companyId }, select: { contentType: true, data: true } });
    return file ? { contentType: file.contentType, data: file.data } : null;
  },
};

export const fileUrl = (id: string) => `/api/files/${id}`;
export const fileIdFromUrl = (url: string) => url.match(/^\/api\/files\/([a-z0-9]+)$/)?.[1] ?? null;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const CLIENT_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** Type réel d'après la signature binaire du fichier, jamais d'après l'en-tête déclaré. */
export function detectImageType(data: Uint8Array): "image/jpeg" | "image/png" | null {
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => data[i] === b)) return "image/png";
  return null;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function readBody(req: IncomingMessage, limit: number): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new HttpError(413, "Fichier trop volumineux (5 Mo maximum)");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

async function requireSession(req: IncomingMessage) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) throw new HttpError(401, "Authentification requise");
  return session.user as typeof session.user & { companyId: string };
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
}

/**
 * POST /api/files        corps binaire (JPEG ou PNG), en-tête `x-client-id` obligatoire
 * GET  /api/files/:id    réservé aux utilisateurs de l'entreprise propriétaire
 */
export async function handleFiles(req: IncomingMessage, res: ServerResponse, store: FileStore = dbFileStore) {
  try {
    const user = await requireSession(req);
    const url = new URL(req.url ?? "/", "http://localhost");

    if (req.method === "POST" && url.pathname === "/api/files") {
      const clientId = String(req.headers["x-client-id"] ?? "");
      if (!CLIENT_ID.test(clientId)) throw new HttpError(400, "En-tête x-client-id invalide");
      const data = await readBody(req, MAX_UPLOAD_BYTES);
      const contentType = detectImageType(data);
      if (!contentType) throw new HttpError(415, "Seules les images JPEG et PNG sont acceptées");
      const { id } = await store.put({ clientId, companyId: user.companyId, contentType, data });
      return send(res, 201, { id, url: fileUrl(id) });
    }

    const match = url.pathname.match(/^\/api\/files\/([a-z0-9]+)$/);
    if (req.method === "GET" && match) {
      const file = await store.get(match[1]!, user.companyId);
      if (!file) throw new HttpError(404, "Fichier introuvable");
      res.writeHead(200, {
        "content-type": file.contentType,
        "content-length": file.data.byteLength,
        "cache-control": "private, max-age=31536000, immutable", // un fichier n'est jamais modifié
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      });
      return res.end(Buffer.from(file.data));
    }

    throw new HttpError(404, "Not Found");
  } catch (error) {
    if (error instanceof HttpError) return send(res, error.status, { error: error.message });
    console.error(error);
    return send(res, 500, { error: "Erreur interne" });
  }
}
