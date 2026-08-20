/**
 * Couvertures génératives des projets.
 *
 * Une capture d'écran réduite à un bandeau de 3,5:1 ne montre rien : on y perd
 * le texte, l'interface devient une texture grise, et les quatre projets se
 * ressemblent. Chaque projet reçoit donc une composition dessinée sur son
 * sujet — un graphe pour une cartographie de notions, une grille de routines
 * pour un assistant mémoire, une série de cours pour un générateur de rapports,
 * un corpus traversé d'une anomalie pour un annuaire climatique.
 *
 * Le langage est celui du reste du site : une grille de cellules carrées, la
 * rampe de cinq neutres, l'accent réservé aux quelques cellules qui portent le
 * sens. Rien n'est animé — c'est du SVG rendu sur le serveur, donc visible sans
 * JavaScript, à l'impression, et dans un flux RSS.
 *
 * Les couleurs sortent en `var(--px-…)` plutôt qu'en hexadécimal : la bascule
 * clair/sombre du site les inverse déjà, la couverture suit sans rien savoir du
 * thème.
 */

// Extension explicite : le runner de tests passe par le résolveur ESM de Node,
// qui n'ajoute pas d'extension tout seul.
import { mulberry32 } from "./pixel-noise.ts";

/** Sujet traité par la couverture. Un par projet. */
export type CoverMotif = "graph" | "routine" | "series" | "corpus";

/**
 * Index dans la rampe, du plus contrasté au plus discret, puis l'accent.
 * Les valeurs suivent `PIXEL_PALETTE`, mais sortent en jetons CSS.
 */
export const COVER_TONES = [
  "var(--ink)",
  "var(--px-slate)",
  "var(--px-steel)",
  "var(--px-grey)",
  "var(--px-mist)",
  "var(--px-accent)",
] as const;

const INK = 0;
const SLATE = 1;
const STEEL = 2;
const GREY = 3;
const MIST = 4;
const ACCENT = 5;

export interface CoverCell {
  col: number;
  row: number;
  tone: number;
}

export interface CoverOptions {
  motif: CoverMotif;
  seed: number;
  cols: number;
  rows: number;
}

/**
 * Grille de travail.
 *
 * `put` ignore silencieusement ce qui déborde : chaque motif calcule en
 * coordonnées continues sans vérifier ses bornes à chaque ligne.
 */
interface Field {
  cols: number;
  rows: number;
  tones: Int8Array;
}

function createField(cols: number, rows: number): Field {
  return { cols, rows, tones: new Int8Array(cols * rows).fill(-1) };
}

function put(field: Field, col: number, row: number, tone: number) {
  const x = Math.round(col);
  const y = Math.round(row);
  if (x < 0 || x >= field.cols || y < 0 || y >= field.rows) return;
  field.tones[y * field.cols + x] = tone;
}

/** Ne pose que si la cellule est vide : les traits ne mangent pas les nœuds. */
function putUnder(field: Field, col: number, row: number, tone: number) {
  const x = Math.round(col);
  const y = Math.round(row);
  if (x < 0 || x >= field.cols || y < 0 || y >= field.rows) return;
  if (field.tones[y * field.cols + x] < 0) field.tones[y * field.cols + x] = tone;
}

function fieldCells(field: Field): CoverCell[] {
  const out: CoverCell[] = [];
  for (let row = 0; row < field.rows; row++) {
    for (let col = 0; col < field.cols; col++) {
      const tone = field.tones[row * field.cols + col];
      if (tone >= 0) out.push({ col, row, tone });
    }
  }
  return out;
}

/** Trace un segment cellule par cellule. Bresenham, sans anticrénelage. */
function line(
  field: Field,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  tone: number,
) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  if (steps === 0) return;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    putUnder(field, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, tone);
  }
}

/**
 * Noxus — la cartographie du savoir.
 *
 * Des nœuds posés sur une grille secouée, reliés chacun à ses trois plus
 * proches voisins. Deux liens seulement donnaient une chaîne : le graphe se
 * lisait comme une polyligne qui serpente, pas comme un maillage. Le pas se
 * cale sur la hauteur pour garder au moins quatre rangées de nœuds, sinon un
 * bandeau très large n'en aligne qu'une.
 */
function graph(field: Field, rand: () => number) {
  const { cols, rows } = field;
  const step = Math.min(6, Math.max(3, Math.round(rows / 4.2)));
  const nodes: { x: number; y: number }[] = [];

  for (let y = step * 0.6; y < rows; y += step) {
    for (let x = step * 0.6; x < cols; x += step) {
      if (rand() < 0.12) continue; // quelques trous, sinon la grille transparaît
      nodes.push({
        x: x + (rand() - 0.5) * step * 0.85,
        y: y + (rand() - 0.5) * step * 0.85,
      });
    }
  }

  // Les arêtes d'abord, pour passer sous les nœuds.
  for (const [index, node] of nodes.entries()) {
    const others = nodes
      .map((other, j) => ({ j, d: Math.hypot(other.x - node.x, other.y - node.y) }))
      .filter((o) => o.j !== index)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    for (const { j, d } of others) {
      // Les liens longs pâlissent : le regard suit d'abord les voisinages
      // serrés, qui sont ceux d'un même niveau du curriculum.
      const far = d > step * 1.4;
      line(field, node.x, node.y, nodes[j].x, nodes[j].y, far ? MIST : GREY);
    }
  }

  for (const node of nodes) {
    const tone = rand() < 0.1 ? ACCENT : rand() < 0.5 ? INK : SLATE;
    put(field, node.x, node.y, tone);
    put(field, node.x + 1, node.y, tone);
    put(field, node.x, node.y + 1, tone);
    put(field, node.x + 1, node.y + 1, tone);
  }
}

/**
 * Plum — la routine tenue.
 *
 * Une matrice : une colonne par jour, une rangée par étape de la routine. La
 * grille entière est posée en gris pâle, puis les étapes faites la remplissent.
 * Les cellules d'accent sont les preuves photo.
 *
 * La première version empilait des barres depuis le bas — c'était un graphique,
 * et il ressemblait à celui de Finalytics. Une matrice dit autre chose : ce
 * n'est pas une quantité qui monte, c'est une grille qu'on remplit.
 *
 * Un jour sur huit reste creux. L'application est faite pour les jours où ça se
 * passe mal ; une grille pleine à cent pour cent raconterait le contraire.
 */
function routine(field: Field, rand: () => number) {
  const { cols, rows } = field;
  const steps = Math.max(3, Math.min(6, Math.round(rows / 3.4)));
  const top = Math.max(0, Math.round((rows - steps * 2) / 2));

  for (let col = 1; col < cols - 1; col += 2) {
    const missed = rand() < 0.12;
    const done = missed
      ? Math.floor(rand() * 2)
      : Math.round(steps * (0.6 + rand() * 0.4));

    for (let i = 0; i < steps; i++) {
      const row = top + i * 2;
      if (i >= done) {
        put(field, col, row, MIST); // l'étape reste à faire
        continue;
      }
      put(field, col, row, rand() < 0.09 ? ACCENT : rand() < 0.35 ? SLATE : INK);
    }
  }
}

/**
 * Finalytics — du cours au document.
 *
 * À gauche une série de chandeliers, à droite le rapport qu'elle produit : des
 * lignes de texte de longueurs inégales, dont une seule en accent. La bascule
 * tombe aux deux tiers, là où le regard a déjà lu la série et cherche sa
 * conclusion.
 *
 * Un chandelier par colonne, pas un sur deux : espacés, ils se lisaient comme
 * une poussière de points et non comme une courbe.
 */
function series(field: Field, rand: () => number) {
  const { cols, rows } = field;
  const split = Math.round(cols * 0.6);
  let value = rows * 0.66;

  for (let col = 1; col < split - 1; col++) {
    // Dérive légèrement haussière : une série qui finit où elle a commencé ne
    // ressemble pas à ce qu'un rapport a à dire.
    const drift = (rand() - 0.58) * rows * 0.22;
    const next = Math.min(rows - 2, Math.max(1, value + drift));
    const rising = next < value;

    const high = Math.min(value, next) - rand() * rows * 0.1;
    const low = Math.max(value, next) + rand() * rows * 0.1;
    for (let y = Math.round(high); y <= Math.round(low); y++) put(field, col, y, MIST);
    for (let y = Math.round(Math.min(value, next)); y <= Math.round(Math.max(value, next)); y++) {
      put(field, col, y, rising ? INK : STEEL);
    }
    value = next;
  }

  const lineRows: number[] = [];
  for (let row = 1; row < rows - 1; row += 2) lineRows.push(row);
  const accentRow = lineRows[Math.floor(rand() * lineRows.length)];
  const room = cols - split - 2;
  for (const row of lineRows) {
    const length = Math.max(3, Math.round(room * (0.3 + rand() * 0.7)));
    for (let i = 0; i < length; i++) {
      put(field, split + 1 + i, row, row === accentRow ? ACCENT : rand() < 0.3 ? GREY : SLATE);
    }
  }
}

/**
 * Corpus Delta — le corpus et l'écart.
 *
 * Des rangées de marques inégales, une par publication, traversées par la
 * courbe d'anomalie qui donne son nom au projet. Les marques que la courbe
 * touche passent à l'encre : c'est la littérature qui documente l'écart.
 */
function corpus(field: Field, rand: () => number) {
  const { cols, rows } = field;

  for (let row = 1; row < rows; row += 2) {
    let col = 1;
    while (col < cols - 1) {
      const length = 2 + Math.floor(rand() * 5);
      for (let i = 0; i < length && col + i < cols; i++) {
        put(field, col + i, row, rand() < 0.35 ? GREY : MIST);
      }
      col += length + 1 + Math.floor(rand() * 2);
    }
  }

  // L'anomalie : plate à gauche, elle décroche sur le dernier tiers.
  for (let col = 0; col < cols; col++) {
    const u = col / (cols - 1);
    const rise = u < 0.45 ? u * 0.22 : 0.1 + (u - 0.45) ** 1.5 * 1.55;
    const y = rows * (0.86 - rise * 0.78);
    put(field, col, y, u > 0.72 ? ACCENT : INK);
    if (col % 2 === 0) putUnder(field, col, y + 1, SLATE);
  }
}

const MOTIFS: Record<CoverMotif, (field: Field, rand: () => number) => void> = {
  graph,
  routine,
  series,
  corpus,
};

/** Les cellules allumées de la couverture, dans l'ordre de lecture. */
export function coverCells({ motif, seed, cols, rows }: CoverOptions): CoverCell[] {
  const field = createField(cols, rows);
  MOTIFS[motif](field, mulberry32(seed));
  return fieldCells(field);
}

export interface CoverRun {
  col: number;
  row: number;
  /** Nombre de cellules consécutives de même ton. */
  length: number;
  tone: number;
}

/**
 * Les mêmes cellules, fusionnées par balayage de ligne.
 *
 * Le SVG part dans le HTML rendu sur le serveur : un `<rect>` par cellule ferait
 * quelques dizaines de milliers de nœuds sur une page qui porte quatre cartes.
 * Les voisines de même ton tiennent dans un seul rectangle, exactement comme le
 * canvas fusionne ses `fillRect`.
 */
export function coverRuns(options: CoverOptions): CoverRun[] {
  const cells = coverCells(options);
  const runs: CoverRun[] = [];
  let current: CoverRun | null = null;

  for (const cell of cells) {
    const joins =
      current !== null &&
      current.row === cell.row &&
      current.tone === cell.tone &&
      current.col + current.length === cell.col;
    if (joins) {
      current!.length++;
      continue;
    }
    current = { col: cell.col, row: cell.row, length: 1, tone: cell.tone };
    runs.push(current);
  }
  return runs;
}
