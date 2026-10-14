import { createPubSub } from "graphql-yoga";

/** Événements temps réel, cloisonnés par entreprise. */
export const pubsub = createPubSub<{
  "intervention:updated": [companyId: string, payload: { interventionId: string }];
}>();
