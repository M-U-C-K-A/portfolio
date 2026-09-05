/**
 * Identité visuelle des projets.
 *
 * Chaque projet porte une couleur et deux compositions générées : un motif de
 * briques pour sa vignette, et un bandeau pour l'en-tête de son cas d'étude.
 * Ce sont les seules surfaces colorées du site — c'est précisément ce qui
 * distingue les projets d'un contenu volontairement neutre.
 *
 * Les deux compositions sont du SVG rendu sur le serveur : visibles sans
 * JavaScript, à l'impression, et dans un flux RSS. Les valeurs passent par
 * `light-dark()`, donc la bascule clair/sombre ne coûte pas une ligne de
 * JavaScript.
 */

// Extension explicite : le runner de tests passe par le résolveur ESM de Node,
// qui n'ajoute pas d'extension tout seul.
import { mulberry32 } from "./pixel-noise.ts";

export type CoverMotif = "graph" | "routine" | "series" | "corpus";

export interface CoverPalette {
  /**
   * Fond du bandeau du cas d'étude, assez soutenu pour porter du texte blanc.
   *
   * Les valeurs sont choisies pour tenir 4,5:1 **au point le plus clair du
   * bandeau** — là où deux voiles de panneaux se recouvrent — et non en
   * moyenne. À pleine couleur elles tournent autour de 8:1. Un premier jeu,
   * plus vif, tenait 6:1 à plat mais tombait à 4,2:1 sous les voiles.
   *
   * Elles ne changent pas avec le thème : un bandeau coloré se lit comme une
   * image, pas comme une surface du site.
   */
  banner: string;
  /** Les barres de la vignette. */
  bar: string;
  /** Le fond sur lequel elles reposent. */
  ground: string;
}

const PALETTES: Record<CoverMotif, CoverPalette> = {
  // Noxus — rouge. Le contraire du bleu du site : une carte de lacunes.
  graph: {
    banner: "#96201d",
    bar: "light-dark(#c9302b, #f27a72)",
    ground: "light-dark(#f3d6d4, #331715)",
  },
  // Plum — vert. Ce qui est fait, ce qui est vivant.
  routine: {
    banner: "#12602f",
    bar: "light-dark(#1f8544, #56c97a)",
    ground: "light-dark(#d3e9da, #16301f)",
  },
  // Finalytics — or. La couleur de la valeur, sans le vert des marchés.
  series: {
    banner: "#654a0c",
    bar: "light-dark(#a97f14, #e0b03c)",
    ground: "light-dark(#efe0bd, #33280f)",
  },
  // Corpus Delta — bleu. L'atmosphère, et la mesure qu'on en fait.
  corpus: {
    banner: "#1745b0",
    bar: "light-dark(#2159d6, #6d94ee)",
    ground: "light-dark(#d3ddf7, #172242)",
  },
};

export const paletteOf = (motif: CoverMotif): CoverPalette => PALETTES[motif];

// --- La vignette : un motif de briques ---------------------------------------

/** Une barre : une cellule de haut, `w` cellules de large. */
export interface Brick {
  x: number;
  y: number;
  w: number;
}

interface Rhythm {
  /** Longueur d'une barre à la position horizontale `u`, de 0 à 1. */
  length: (u: number, rand: () => number) => number;
  /** Espace entre deux barres. */
  gap: (rand: () => number) => number;
}

const RHYTHMS: Record<CoverMotif, Rhythm> = {
  // Longueurs très inégales : un graphe n'a pas de mesure.
  graph: {
    length: (_u, rand) => 1 + Math.floor(rand() * 4),
    gap: (rand) => (rand() < 0.22 ? 2 : 1),
  },
  // Une cadence régulière, qui dérive à peine : la routine se répète sans
  // jamais être tout à fait la même.
  routine: {
    length: (_u, rand) => (rand() < 0.72 ? 2 : 3),
    gap: (rand) => (rand() < 0.12 ? 2 : 1),
  },
  // Des barres qui s'allongent vers la droite : la série, puis sa conclusion.
  series: {
    length: (u, rand) => 1 + Math.floor(rand() * (1 + u * 4.5)),
    gap: (rand) => (rand() < 0.3 ? 2 : 1),
  },
  // Des barres longues, comme des lignes d'une bibliographie.
  corpus: {
    length: (_u, rand) => 2 + Math.floor(rand() * 5),
    gap: () => 1,
  },
};

/**
 * Les barres de la vignette.
 *
 * Une rangée par ligne de la grille, remplie de barres séparées d'un jour.
 * Chaque rangée démarre avec un décalage propre, sinon les barres s'alignent en
 * colonnes et le motif devient un damier.
 *
 * Le tirage est semé : la vignette d'un projet est la même à chaque build,
 * sinon elle changerait à chaque déploiement.
 */
export function brickRows({
  motif,
  seed,
  cols,
  rows,
}: {
  motif: CoverMotif;
  seed: number;
  cols: number;
  rows: number;
}): Brick[] {
  const rhythm = RHYTHMS[motif];
  const rand = mulberry32(seed);
  const bricks: Brick[] = [];

  for (let y = 0; y < rows; y++) {
    let x = Math.floor(rand() * 3) - 2;
    while (x < cols) {
      const length = rhythm.length(Math.max(0, x) / cols, rand);
      const from = Math.max(0, x);
      const to = Math.min(cols, x + length);
      if (to > from) bricks.push({ x: from, y, w: to - from });
      x = x + length + rhythm.gap(rand);
    }
  }
  return bricks;
}

// --- Le bandeau : de grands panneaux translucides ----------------------------

/** Un panneau du bandeau. `tint` est l'opacité du voile blanc posé dessus. */
export interface Panel {
  x: number;
  y: number;
  w: number;
  h: number;
  tint: number;
}

/** Grille de composition du bandeau, en cellules. */
export const BANNER_COLS = 18;
export const BANNER_ROWS = 7;

/**
 * Les panneaux du bandeau.
 *
 * De grands rectangles voilés de blanc, posés sur le fond coloré. Ils ne
 * découpent rien : ils se recouvrent, et c'est le cumul des voiles qui donne
 * la profondeur. Deux d'entre eux assombrissent au lieu d'éclaircir, sans quoi
 * le bandeau ne fait que pâlir vers un coin.
 *
 * Les voiles restent faibles — le texte blanc passe par-dessus, et il doit
 * garder son contraste sur n'importe quel point du bandeau.
 */
export function bannerPanels({
  motif,
  seed,
}: {
  motif: CoverMotif;
  seed: number;
}): Panel[] {
  const rand = mulberry32(seed ^ 0x5eed);
  const rhythm = RHYTHMS[motif];
  const panels: Panel[] = [];
  const count = 11 + Math.floor(rand() * 4);

  for (let i = 0; i < count; i++) {
    const w = 2 + Math.floor(rand() * 5) + Math.round(rhythm.length(rand(), rand) / 2);
    const h = 1 + Math.floor(rand() * 3);
    panels.push({
      x: Math.floor(rand() * (BANNER_COLS - 1)) - 1,
      y: Math.floor(rand() * (BANNER_ROWS - 1)),
      w,
      h,
      // Un panneau sur cinq creuse au lieu d'éclairer.
      tint: rand() < 0.2 ? -0.055 : 0.04 + rand() * 0.05,
    });
  }
  return panels;
}
