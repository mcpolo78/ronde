import { build } from "esbuild";

/**
 * Compile l'API en un seul fichier JavaScript (dist/index.js) pour la production :
 * au démarrage, Node n'a plus à transpiler le TypeScript (démarrage à froid plus rapide sur Cloud Run).
 * Les paquets npm de l'API restent externes (installés dans l'image Docker) ; le code du monorepo (@ronde/*)
 * est intégré, avec ses propres dépendances, que l'API ne déclare pas.
 */
await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  sourcemap: true,
  logLevel: "info",
  plugins: [
    {
      name: "external-npm-packages",
      setup(b) {
        b.onResolve({ filter: /^[^./]/ }, (args) => {
          const fromWorkspacePackage = args.importer.split(/[\\/]/).includes("packages");
          if (args.path.startsWith("@ronde/") || fromWorkspacePackage) return undefined;
          return { path: args.path, external: true };
        });
      },
    },
  ],
});
