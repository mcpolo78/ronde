import { describe, expect, it } from "vitest";
import { buildSignatureSvg, signatureStrokesSchema, strokeToPath } from "./signature";

describe("signature", () => {
  it("convertit un tracé en chemin SVG arrondi", () => {
    expect(strokeToPath([10, 20, 30.456, 40.04])).toBe("M 10 20 L 30.5 40");
    expect(strokeToPath([5, 5])).toBe("M 5 5 L 5 5"); // simple point
  });

  it("construit un SVG ne contenant que des nombres issus de la saisie", () => {
    const svg = buildSignatureSvg({ width: 300, height: 120, strokes: [[1, 2, 3, 4]] });
    expect(svg).toContain('viewBox="0 0 300 120"');
    expect(svg).toContain('<path d="M 1 2 L 3 4"/>');
  });

  it("refuse les signatures vides, les coordonnées impaires ou non numériques", () => {
    expect(signatureStrokesSchema.safeParse({ width: 300, height: 120, strokes: [] }).success).toBe(false);
    expect(signatureStrokesSchema.safeParse({ width: 300, height: 120, strokes: [[1, 2, 3]] }).success).toBe(false);
    expect(
      signatureStrokesSchema.safeParse({ width: 300, height: 120, strokes: [["<script>", 2]] }).success,
    ).toBe(false);
    expect(signatureStrokesSchema.safeParse({ width: 300, height: 120, strokes: [[1, 2, 3, 4]] }).success).toBe(true);
  });
});
