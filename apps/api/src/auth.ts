import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db";

export const trustedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

/** Origines de l'app mobile : schéma de l'app (build) et Expo Go (développement). */
const mobileOrigins = ["ronde://", ...(process.env.NODE_ENV === "production" ? [] : ["exp://"])];

/**
 * Authentification email + mot de passe.
 * Les comptes sont créés par l'entreprise (B2B) : pas d'inscription publique.
 * `BETTER_AUTH_URL` est l'URL publique du back-office : le navigateur y appelle
 * /api/auth/*, que Next.js relaie vers l'API (cookies sur le même domaine).
 */
export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  basePath: "/api/auth",
  trustedOrigins: [...trustedOrigins, ...mobileOrigins],
  // Le mobile envoie le cookie de session dans un en-tête (stockage sécurisé du téléphone)
  plugins: [expo()],
  database: prismaAdapter(prisma, { provider: "postgresql", transaction: true }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 jours : un technicien ne doit pas être déconnecté en tournée
    updateAge: 60 * 60 * 24,
    // Évite une requête en base à chaque appel GraphQL ; révocation effective sous 5 min.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  user: {
    additionalFields: {
      role: { type: "string", required: true, input: false },
      companyId: { type: "string", required: true, input: false },
    },
  },
  advanced: {
    database: { generateId: false }, // les identifiants sont générés par Prisma (cuid)
  },
});
