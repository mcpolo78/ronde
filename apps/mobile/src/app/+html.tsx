import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/** Document HTML de la version web de l'app (tests E2E, démo navigateur). */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>Ronde — app technicien</title>
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
