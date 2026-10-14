import type { YogaInitialContext } from "graphql-yoga";
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
 * TEMPORAIRE (S1) : en développement, l'utilisateur courant est choisi via l'en-tête
 * `x-dev-user` (son email). Remplacé par les sessions Better Auth en S2 ; désactivé en production.
 */
export async function createContext({ request }: YogaInitialContext): Promise<Context> {
  if (process.env.NODE_ENV === "production") return { viewer: null };
  const email = request.headers.get("x-dev-user");
  if (!email) return { viewer: null };
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, companyId: true, role: true },
  });
  return { viewer: user };
}
