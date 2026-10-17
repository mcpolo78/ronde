const API_URL = process.env.API_URL ?? "http://localhost:4000";

/**
 * État de l'API, interrogé par l'écran d'attente depuis le navigateur.
 * Passe par le serveur Next.js : pas de CORS, et l'adresse de l'API reste côté serveur.
 */
export async function GET() {
  let isUp = false;
  try {
    const response = await fetch(`${API_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    isUp = response.ok && (await response.text()).trim() === "ok";
  } catch {
    isUp = false;
  }
  return Response.json({ isUp }, { status: isUp ? 200 : 503, headers: { "cache-control": "no-store" } });
}
