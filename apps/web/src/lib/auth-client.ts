import { createAuthClient } from "better-auth/react";

// Même origine que le back-office : /api/auth/* est relayé vers l'API par next.config.ts.
export const authClient = createAuthClient();
