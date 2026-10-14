// Génère les icônes et l'écran de démarrage de l'app à partir d'un même dessin vectoriel.
// node scripts/generate-icons.mjs
import sharp from "sharp";

const BRAND = "#0f766e";
const ACCENT = "#5eead4";

/** L'anneau (la tournée) et le point qui la parcourt. `scale` réduit le dessin pour les zones de sécurité. */
const mark = (color, scale = 1, dot = ACCENT) => {
  const r = 300 * scale;
  const stroke = 78 * scale;
  const angle = -Math.PI / 4; // en haut à droite
  const x = 512 + Math.cos(angle) * r;
  const y = 512 + Math.sin(angle) * r;
  return `<circle cx="512" cy="512" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"/>
    <circle cx="${x}" cy="${y}" r="${92 * scale}" fill="${dot}" stroke="${BRAND}" stroke-width="${24 * scale}"/>`;
};
const svg = (content, background) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    ${background ? `<rect width="1024" height="1024" fill="${background}"/>` : ""}${content}</svg>`);

const out = (name) => `assets/images/${name}`;
await sharp(svg(mark("#ffffff"), BRAND)).png().toFile(out("icon.png"));
// Android : icône adaptative (le système découpe un cercle ou un carré arrondi au centre)
await sharp(svg(mark("#ffffff", 0.62))).png().toFile(out("android-icon-foreground.png"));
await sharp(svg("", BRAND)).png().toFile(out("android-icon-background.png"));
await sharp(svg(mark("#ffffff", 0.62, "#ffffff"))).png().toFile(out("android-icon-monochrome.png"));
await sharp(svg(mark("#ffffff", 0.9))).png().toFile(out("splash-icon.png"));
await sharp(svg(mark("#ffffff"), BRAND)).resize(48, 48).png().toFile(out("favicon.png"));
console.log("Icônes générées dans assets/images/");
