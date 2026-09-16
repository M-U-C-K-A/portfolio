/**
 * Ce que partagent les images de partage.
 *
 * Trois routes en génèrent — l'accueil, les cas d'étude, les articles — et
 * toutes ont besoin des mêmes polices et du même monogramme.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const OG_SIZE = { width: 1200, height: 630 };

type Font = {
  name: string;
  data: Buffer;
  weight: 400 | 600;
  style: "normal";
};

let fonts: Promise<Font[]> | null = null;

/**
 * Les deux graisses d'Inter Tight, lues une seule fois pour tout le build.
 *
 * Satori n'a pas accès aux polices du site : il faut lui passer les fichiers.
 * Sous-ensemble latin et accents français, 44 ko par graisse contre 300 pour
 * la fonte complète — le bundle d'une image est plafonné à 500 ko. Un
 * caractère hors de ce jeu rendrait en tofu ; les titres actuels n'utilisent
 * que l'ASCII, « é », « à » et l'apostrophe typographique.
 */
export function ogFonts() {
  fonts ??= Promise.all([
    readFile(join(process.cwd(), "assets/fonts/InterTight-Regular.ttf")),
    readFile(join(process.cwd(), "assets/fonts/InterTight-SemiBold.ttf")),
  ]).then(([regular, semibold]): Font[] => [
    { name: "Inter Tight", data: regular, weight: 400, style: "normal" },
    { name: "Inter Tight", data: semibold, weight: 600, style: "normal" },
  ]);
  return fonts;
}

/**
 * Le monogramme « HD » en pixels, en coordonnées d'une grille 9 × 7.
 *
 * C'était l'ancien favicon. Celui-ci est devenu un avatar, et les images de
 * partage gardent le monogramme : à 64 px, les lettres se lisent mieux qu'un
 * visage réduit.
 */
const GLYPH = [
  [1, 1, 1, 5],
  [3, 1, 1, 5],
  [2, 3, 1, 1],
  [5, 1, 1, 5],
  [6, 1, 1, 1],
  [7, 2, 1, 3],
  [6, 5, 1, 1],
] as const;

/**
 * Le monogramme, en image SVG prête pour un attribut `src`.
 *
 * Satori ne lit pas un composant pour un `<img>`, seulement une adresse : d'où
 * l'URI de données. La lettre est centrée sur une grille de 11 × 11 — son
 * dessin occupe 7 × 5 cellules, décalé d'une dans la grille d'origine.
 */
export function monogram({
  shape,
  background,
  foreground,
}: {
  shape: "circle" | "square";
  background: string;
  foreground: string;
}) {
  const plate =
    shape === "circle"
      ? `<circle cx="5.5" cy="5.5" r="5.5" fill="${background}"/>`
      : `<rect width="11" height="11" rx="2" fill="${background}"/>`;
  const glyph = GLYPH.map(
    ([x, y, w, h]) => `<rect x="${x + 1}" y="${y + 2}" width="${w}" height="${h}"/>`,
  ).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11" shape-rendering="crispEdges">${plate}<g fill="${foreground}">${glyph}</g></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
