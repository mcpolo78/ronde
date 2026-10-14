import type { MetadataRoute } from "next";

/** Back-office privé : seule la page de connexion peut être indexée. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/login", disallow: "/" },
  };
}
