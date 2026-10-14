import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { gql } from "./api";
import { MeQuery, type Viewer } from "./queries";

/** Utilisateur connecté (une seule requête par rendu grâce à `cache`). */
export const getViewer = cache(async (): Promise<Viewer> => {
  const { me } = await gql(MeQuery);
  if (!me) redirect("/login");
  return me;
});

/**
 * Les blocs de données des pages s'arrêtent net pour un technicien : la garde de rôle
 * du layout affiche son message, inutile d'envoyer des requêtes que l'API refuserait.
 */
export async function isManager() {
  return (await getViewer()).role === "MANAGER";
}
