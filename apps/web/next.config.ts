import type { NextConfig } from "next";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@ronde/domain", "@ronde/graphql"],
  // Le navigateur ne parle qu'au domaine du back-office : l'authentification et GraphQL
  // sont relayés vers l'API, les cookies de session restent donc « first-party ».
  async rewrites() {
    return [
      { source: "/api/auth/:path*", destination: `${API_URL}/api/auth/:path*` },
      { source: "/api/graphql", destination: `${API_URL}/graphql` },
      // photos et signatures : servies sur le même domaine, le cookie de session suit
      { source: "/api/files/:id", destination: `${API_URL}/api/files/:id` },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
