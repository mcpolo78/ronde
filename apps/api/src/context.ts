import type { YogaInitialContext } from "graphql-yoga";
import { auth } from "./auth";
import { prisma } from "./db";
import type { Role } from "./generated/prisma/client";

export interface Viewer {
  id: string;
  companyId: string;
  role: Role;
}

export interface Context {
  viewer: Viewer | null;
}

/**
 * Raccourci de développement : avec `ALLOW_DEV_IMPERSONATION=true`, l'en-tête `x-dev-user`
 * (un email) remplace la session. Pratique dans GraphiQL et les tests ; jamais activé en production.
 */
const devImpersonation =
  process.env.ALLOW_DEV_IMPERSONATION === "true" && process.env.NODE_ENV !== "production";

export async function createContext({ request }: YogaInitialContext): Promise<Context> {
  const devEmail = devImpersonation ? request.headers.get("x-dev-user") : null;
  if (devEmail) {
    const user = await prisma.user.findUnique({
      where: { email: devEmail },
      select: { id: true, companyId: true, role: true },
    });
    return { viewer: user };
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return { viewer: null };
  const { id, companyId, role } = session.user;
  return { viewer: { id, companyId, role: role as Role } };
}
