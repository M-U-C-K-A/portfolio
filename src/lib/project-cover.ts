/**
 * Couvertures génératives des projets.
 *
 * Une capture d'écran réduite à un bandeau de 3,5:1 ne montre rien : le texte
 * disparaît, l'interface devient une texture grise, et les quatre projets se
 * ressemblent. Chacun reçoit donc une composition dessinée.
 *
 * La première version traçait des pixels isolés sur fond de papier. Trop pâle
 * et trop maigre : à la taille d'une vignette il ne restait qu'un gribouillis
 * gris. Celle-ci découpe le cadre en mosaïque — des tuiles de tailles très
 * inégales, sans vide entre elles — et donne à chaque projet **sa** couleur :
 * rouge pour Noxus, vert pour Plum, or pour Finalytics, bleu ciel pour Corpus
 * Delta. Ce sont les seules surfaces colorées du site, et c'est voulu : elles
 * distinguent les projets là où le reste est volontairement neutre.
 *
 * Le découpage garde une trace du sujet : le graphe rayonne d'un foyer, la
 * routine se répète en bandes régulières, la série monte en colonnes, le corpus
 * s'empile en rangées traversées d'une pente.
 *
 * Tout sort en SVG rendu sur le serveur — visible sans JavaScript, à
 * l'impression, dans un flux RSS. Les neutres sont des jetons du site et les
 * couleurs passent par `light-dark()`, donc la bascule clair/sombre est gérée
 * sans une ligne de JavaScript.
 */

// Extension explicite : le runner de tests passe par le résolveur ESM de Node,
// qui n'ajoute pas d'extension tout seul.
import { mulberry32 } from "./pixel-noise.ts";

export type CoverMotif = "graph" | "routine" | "series" | "corpus";

/**
 * Rampe d'une couverture : cinq neutres du site, puis trois valeurs de la
 * couleur du projet — soutenue, moyenne, lavée.
 *
 * Les neutres sont des jetons, donc déjà inversés en mode sombre. Les couleurs
 * le font elles-mêmes : la valeur sombre est plus claire et moins saturée, le
 * ton de jour ne tenant pas le contraste sur fond noir.
 */
const NEUTRALS = [
  "var(--ink)",
  "var(--px-slate)",
  "var(--px-steel)",
  "var(--px-grey)",
  "var(--px-mist)",
] as const;

const HUES: Record<CoverMotif, readonly [string, string, string]> = {
  // Noxus — rouge. Le contraire du bleu du site : une carte de lacunes.
  graph: [
    "light-dark(#c92a2a, #ff8787)",
    "light-dark(#f03e3e, #ffa8a8)",
    "light-dark(#ffd3d3, #4a2626)",
  ],
  // Plum — vert clair. Ce qui est fait, ce qui est vivant.
  routine: [
    "light-dark(#2f9e44, #8ce99a)",
    "light-dark(#51cf66, #b2f2bb)",
    "light-dark(#d8f5dd, #23402a)",
  ],
  // Finalytics — or. La couleur de la valeur, sans le vert des marchés.
  series: [
    "light-dark(#b8860b, #ffd43b)",
    "light-dark(#e6a817, #ffe08a)",
    "light-dark(#faeccd, #43391a)",
  ],
  // Corpus Delta — bleu ciel. L'atmosphère, et la mesure qu'on en fait.
  corpus: [
    "light-dark(#1c7ed6, #74c0fc)",
    "light-dark(#4dabf7, #a5d8ff)",
    "light-dark(#d6ebfb, #1b3448)",
  ],
};

/** Index de ton : 0-4 neutres du plus sombre au plus clair, 5-7 la couleur. */
const HUE_STRONG = 5;
const HUE_MID = 6;
const HUE_WASH = 7;

export function coverTones(motif: CoverMotif): string[] {
  return [...NEUTRALS, ...HUES[motif]];
}

export interface CoverTile {
  x: number;
  y: number;
  w: number;
  h: number;
  tone: number;
}

export interface CoverOptions {
  motif: CoverMotif;
  seed: number;
  cols: number;
  rows: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Recipe {
  /** Probabilité de couper dans le sens vertical plutôt qu'horizontal. */
  vertical: number;
  /** Côté minimal d'une tuile, en cellules. */
  min: number;
  /** Profondeur maximale de découpe. */
  depth: number;
  /**
   * Chance d'arrêter une découpe en cours de route, d'où l'inégalité des
   * tailles. Elle ne s'applique qu'aux tuiles déjà petites : autorisée partout,
   * elle laissait des blocs occupant la moitié du cadre.
   */
  stop: number;
  /** Où la coupe tombe : 0,5 coupe au milieu, 0 aux extrémités. */
  balance: number;
  /** Valeur du champ en un point du cadre, de 0 à 1. */
  field: (u: number, v: number) => number;
}

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const wave = (t: number) => 0.5 + 0.5 * Math.sin(t);
const smoothstep = (t: number) => t * t * (3 - 2 * t);
/**
 * Pousse les valeurs vers les extrémités.
 *
 * Sans cela le champ reste massé autour de 0,5 et la composition part en gris
 * moyen : beaucoup de tuiles, aucun contraste, et la couleur ne ressort plus.
 */
const polarise = (t: number) => smoothstep(smoothstep(clamp01(t)));

const RECIPES: Record<CoverMotif, Recipe> = {
  // Un foyer d'où tout part, et des anneaux : la carte des dépendances vue de
  // loin. Les coupes sont équilibrées entre les deux sens — un graphe n'a pas
  // de direction privilégiée.
  graph: {
    vertical: 0.5,
    min: 1,
    depth: 7,
    stop: 0.26,
    balance: 0.34,
    field: (u, v) => {
      const d = Math.hypot(u - 0.3, (v - 0.45) * 1.35);
      return clamp01(1 - d * 1.25) * 0.72 + wave(d * 13) * 0.28;
    },
  },
  // Des bandes régulières, une par étape, avec une lente dérive : la routine se
  // répète sans jamais être tout à fait la même.
  routine: {
    vertical: 0.62,
    min: 1,
    depth: 7,
    stop: 0.24,
    balance: 0.42,
    field: (u, v) => wave(v * 17 + u * 2.2) * 0.86 + (1 - u) * 0.22,
  },
  // Des colonnes, et une pente qui monte vers la droite : la série, puis sa
  // conclusion.
  series: {
    vertical: 0.78,
    min: 1,
    depth: 7,
    stop: 0.26,
    balance: 0.3,
    field: (u, v) => clamp01(u * 1.15 + (1 - v) * 0.5 - 0.3) * 0.8 + wave(u * 21) * 0.2,
  },
  // Des rangées empilées, traversées d'une diagonale : le corpus, et l'écart
  // qui le traverse.
  corpus: {
    vertical: 0.26,
    min: 1,
    depth: 7,
    stop: 0.22,
    balance: 0.4,
    field: (u, v) => {
      const slope = clamp01(1 - Math.abs(v - (0.92 - u * 0.72)) * 4.6);
      return Math.max(slope, wave(v * 17) * 0.52 + u * 0.2);
    },
  },
};

/** Découpe récursive du cadre. Les tuiles pavent tout, sans vide ni recouvrement. */
function carve(
  rect: Rect,
  recipe: Recipe,
  rand: () => number,
  depth: number,
  /** Aire en dessous de laquelle une tuile a le droit de rester entière. */
  restable: number,
  out: Rect[],
) {
  const splitX = rect.w >= recipe.min * 2;
  const splitY = rect.h >= recipe.min * 2;
  const small = rect.w * rect.h <= restable;
  if (depth <= 0 || (!splitX && !splitY) || (small && rand() < recipe.stop)) {
    out.push(rect);
    return;
  }

  const vertical = splitX && (!splitY || rand() < recipe.vertical);
  const span = vertical ? rect.w : rect.h;
  // La coupe s'écarte du milieu, ce qui produit des tuiles de tailles très
  // inégales — c'est ce qui distingue une mosaïque d'un damier.
  const offset = (rand() - 0.5) * (1 - recipe.balance * 2) * span;
  const cut = Math.max(
    recipe.min,
    Math.min(span - recipe.min, Math.round(span / 2 + offset)),
  );

  if (vertical) {
    carve({ ...rect, w: cut }, recipe, rand, depth - 1, restable, out);
    carve({ x: rect.x + cut, y: rect.y, w: rect.w - cut, h: rect.h }, recipe, rand, depth - 1, restable, out);
  } else {
    carve({ ...rect, h: cut }, recipe, rand, depth - 1, restable, out);
    carve({ x: rect.x, y: rect.y + cut, w: rect.w, h: rect.h - cut }, recipe, rand, depth - 1, restable, out);
  }
}

/**
 * Les tuiles de la couverture.
 *
 * Le champ décide du ton : plus il est haut, plus la tuile est sombre, et plus
 * elle a de chances de prendre la couleur. La couleur soutenue est réservée aux
 * petites tuiles — étalée sur un grand aplat elle mangerait la composition ;
 * concentrée sur des éclats, elle la tient.
 *
 * Le tirage est semé, donc la couverture d'un projet est la même à chaque
 * build : sinon elle changerait à chaque déploiement.
 */
export function coverTiles({ motif, seed, cols, rows }: CoverOptions): CoverTile[] {
  const recipe = RECIPES[motif];
  const rand = mulberry32(seed);
  const rects: Rect[] = [];
  const frame = cols * rows;
  carve({ x: 0, y: 0, w: cols, h: rows }, recipe, rand, recipe.depth, frame / 14, rects);

  const large = (cols * rows) / 26;
  return rects.map((rect) => {
    const t = polarise(
      recipe.field((rect.x + rect.w / 2) / cols, (rect.y + rect.h / 2) / rows),
    );
    const area = rect.w * rect.h;

    // La couleur soutenue est réservée aux petites tuiles : étalée sur un grand
    // aplat elle mange la composition, concentrée en éclats elle la tient.
    if (rand() < t * 0.62) {
      const tone = area > large ? HUE_WASH : t > 0.66 ? HUE_STRONG : HUE_MID;
      return { ...rect, tone };
    }
    // Cinq crans de neutres. Plus une tuile est grande, plus son plancher est
    // clair : un aplat d'encre de la moitié du cadre écrase tout le reste, et
    // deux dans la même composition la rendent illisible.
    const step = Math.min(4, Math.floor((1 - t) * 5));
    const floor = area > large * 2.5 ? 2 : area > large ? 1 : 0;
    return { ...rect, tone: Math.max(floor, step) };
  });
}
