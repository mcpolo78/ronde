import { z } from "zod";

/**
 * Signature du client, capturée sur le mobile sous forme de tracés.
 * Chaque tracé est une liste plate de coordonnées [x1, y1, x2, y2, …] dans un repère
 * `width × height`. Le SVG est toujours reconstruit côté serveur à partir de nombres :
 * aucun balisage fourni par un client n'est jamais servi (pas d'injection de script).
 */
export const MAX_SIGNATURE_STROKES = 60;
export const MAX_POINTS_PER_STROKE = 800;

const coordinate = z.number().finite().min(-10).max(4000);

export const signatureStrokesSchema = z.object({
  width: z.number().int().min(50).max(4000),
  height: z.number().int().min(30).max(4000),
  strokes: z
    .array(
      z
        .array(coordinate)
        .min(2)
        .max(MAX_POINTS_PER_STROKE * 2)
        .refine((points) => points.length % 2 === 0, "Nombre de coordonnées impair"),
    )
    .min(1, "La signature est vide")
    .max(MAX_SIGNATURE_STROKES),
});

export type SignatureStrokes = z.infer<typeof signatureStrokesSchema>;

const round = (n: number) => Math.round(n * 10) / 10;

/** Chemin SVG d'un tracé (« M x y L x y … »). Un tracé d'un seul point devient un point visible. */
export function strokeToPath(points: number[]): string {
  const pairs: string[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) pairs.push(`${round(points[i]!)} ${round(points[i + 1]!)}`);
  if (pairs.length === 1) pairs.push(pairs[0]!);
  return `M ${pairs[0]} ` + pairs.slice(1).map((p) => `L ${p}`).join(" ");
}

export function buildSignatureSvg({ width, height, strokes }: SignatureStrokes): string {
  const paths = strokes
    .map((s) => `<path d="${strokeToPath(s)}"/>`)
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">` +
    `<g fill="none" stroke="#18181b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">` +
    paths +
    `</g></svg>`
  );
}
