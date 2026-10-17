const API_URL = process.env.API_URL ?? "http://localhost:4000";

/**
 * État de l'API, interrogé par l'écran d'attente depuis le navigateur.
 * Passe par le serveur Next.js : pas de CORS, et l'adresse de l'API reste côté serveur.
 * `?wake` : toujours 202, l'état est dans le JSON (pas d'erreur 503 dans la console du visiteur) ;
 * utilisé par le portfolio (réveil) et par les écrans d'attente.
 */
export async function GET(request: Request) {
  const isWakeCall = new URL(request.url).searchParams.has("wake");
  const started = Date.now();
  let isUp = false;
  let detail = "";
  try {
    const response = await fetch(`${API_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.text()).trim();
    isUp = response.ok && body === "ok";
    detail = `HTTP ${response.status} ${JSON.stringify(body.slice(0, 120))} render=${response.headers.get("x-render-routing") ?? "-"}`;
  } catch (error) {
    detail = error instanceof Error ? `${error.name}: ${error.message} ${String(error.cause ?? "")}` : String(error);
  }
  // Diagnostic du réveil de l'API : ce que Render répond pendant sa mise en veille
  if (!isUp) console.warn(`[health] API indisponible après ${Date.now() - started} ms : ${detail}`);
  const status = isWakeCall ? 202 : isUp ? 200 : 503;
  return Response.json({ isUp }, { status, headers: { "cache-control": "no-store" } });
}
