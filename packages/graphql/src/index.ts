import { initGraphQLTada } from "gql.tada";
import type { introspection } from "./graphql-env";

/**
 * `graphql()` typé à partir du schéma de l'API : chaque requête écrite côté web
 * ou mobile est vérifiée par TypeScript (champs, arguments, types des résultats).
 * Les dates arrivent en chaînes ISO (sérialisation JSON).
 */
export const graphql = initGraphQLTada<{
  introspection: introspection;
  scalars: { DateTime: string; ID: string };
  // Les fragments servent à mutualiser les sélections, pas à isoler les composants.
  disableMasking: true;
}>();

export type { FragmentOf, ResultOf, VariablesOf, TadaDocumentNode } from "gql.tada";
export { readFragment } from "gql.tada";
