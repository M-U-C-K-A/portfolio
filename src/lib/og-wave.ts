/**
 * Champ de pixels de l'image de partage.
 *
 * Le ruban de `motifFlow`, figé et tiré à pleine page. Mêmes harmoniques que
 * le canvas : deux sinusoïdes de périodes incommensurables donnent la courbe,
 * et la distance à son axe fait tout le reste — le ton, l'opacité, et le fait
 * même qu'une cellule existe.
 *
 * Le module est à part de `opengraph-image.tsx` pour la même raison que
 * `pixel-engine.ts` est à part de son composant : il ne dépend de rien, donc
 * il se teste. Et il faut le tester, parce que l'atténuation sous les textes
 * est la seule chose qui garde la vignette lisible, et qu'elle est invisible à
 * la relecture.
 */

// Extension explicite : le runner de tests passe par le résolveur ESM de Node,
// qui n'ajoute pas d'extension tout seul.
import { PIXEL_PALETTE } from "./pixel-engine.ts";
import { mulberry32 } from "./pixel-noise.ts";

export const WIDTH = 1200;
export const HEIGHT = 630;

/** Côté d'une cellule et espace entre deux, en px de l'image. */
export const CELL = 22;
const GAP = 4;
const STEP = CELL + GAP;
// La grille déborde de quelques pixels sur les quatre bords : sans ce débord
// on lirait une marge blanche régulière, donc un cadre, et le ruban perdrait
// son air de continuer hors de l'image.
const COLS = 47;
const ROWS = 25;
const BLEED_X = (COLS * STEP - GAP - WIDTH) / 2;
const BLEED_Y = (ROWS * STEP - GAP - HEIGHT) / 2;

/** Demi-épaisseur du ruban, en rangées, avant le tirage qui en déchire le bord. */
const REACH = 4.7;

export interface KeepOut {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Largeur du fondu autour de la zone, en px. */
  feather: number;
  /** Ce qu'il reste du ruban au centre de la zone, de 0 à 1. */
  floor: number;
}

/**
 * Zones où le ruban s'efface, en px de l'image.
 *
 * La courbe est déjà choisie pour que son cœur passe à deux rangées du titre ;
 * ces fondus n'éteignent que la frange. Le titre en garde un reste bien
 * visible — il pèse assez pour ça. Les petits textes gris, eux, se perdraient
 * dans le damier : derrière eux il ne doit presque rien rester.
 *
 * Ce sont des rectangles codés en dur : Satori ne mesure aucun texte pour
 * nous. Ils doivent suivre les blocs s'ils changent de taille ou de place, et
 * `tests/og-wave.test.ts` échoue si l'un d'eux se met à laisser passer trop.
 */
export const KEEP_OUT: KeepOut[] = [
  // HUGO / DELACOUR, calé en bas à droite.
  { x0: 470, y0: 220, x1: 1134, y1: 496, feather: 56, floor: 0.42 },
  // PARIS, FRANCE.
  { x0: 886, y0: 44, x1: 1140, y1: 96, feather: 40, floor: 0.12 },
  // Développeur Front-End.
  { x0: 56, y0: 534, x1: 366, y1: 584, feather: 44, floor: 0.12 },
  // hugodelacour.com.
  { x0: 902, y0: 534, x1: 1140, y1: 584, feather: 44, floor: 0.12 },
];

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (t: number) => t * t * (3 - 2 * t);

const RGB = PIXEL_PALETTE.map((hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]);

/** Atténuation du ruban sous les textes : 1 au loin, `floor` dessus. */
function behindText(cx: number, cy: number) {
  let factor = 1;
  for (const box of KEEP_OUT) {
    const dx = Math.max(box.x0 - cx, cx - box.x1, 0);
    const dy = Math.max(box.y0 - cy, cy - box.y1, 0);
    const out = Math.min(1, Math.hypot(dx, dy) / box.feather);
    factor *= box.floor + (1 - box.floor) * smoothstep(out);
  }
  return factor;
}

export interface WaveCell {
  left: number;
  top: number;
  /** Index dans `PIXEL_PALETTE`. */
  tone: number;
  alpha: number;
  fill: string;
}

/**
 * Le champ, en une image SVG prête à poser dans la vignette.
 *
 * Satori décale les enfants en position absolue de quelques pixels, et d'une
 * rangée entière en vertical — assez pour qu'une crête sombre vienne se poser
 * sur la ligne de pied alors que le calcul la plaçait au-dessus. Passer par un
 * SVG rend les coordonnées littérales : le `viewBox` est le cadre, un `rect`
 * est là où on l'écrit. Accessoirement, un nœud au lieu de trois cent
 * soixante et un.
 */
export function waveSvg() {
  const rects = waveCells()
    .map(
      (c) =>
        `<rect x="${c.left}" y="${c.top}" width="${CELL}" height="${CELL}" fill="${PIXEL_PALETTE[c.tone]}" opacity="${c.alpha.toFixed(3)}"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${rects}</svg>`;
}

/** Le même, encodé pour un attribut `src`. */
export function waveSvgDataUri() {
  return `data:image/svg+xml;base64,${Buffer.from(waveSvg()).toString("base64")}`;
}

/**
 * Les cellules allumées du champ, en position absolue.
 *
 * La portée varie d'une cellule à l'autre, ce qui déchire le bord du ruban au
 * lieu de lui laisser un contour net. Le tirage est semé, donc l'image est
 * identique d'un build à l'autre : sinon la vignette changerait à chaque
 * déploiement.
 *
 * Seules les cellules allumées sont émises. Peindre les 1 175 cases coûterait
 * le double pour un résultat identique.
 */
export function waveCells(): WaveCell[] {
  const rand = mulberry32(0x0c7a);
  const cells: WaveCell[] = [];

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const u = x / (COLS - 1);
      const wave = Math.sin(u * 4.2 + 1.8) * 0.66 + Math.sin(u * 9 + 1) * 0.26;
      const axis = (ROWS - 1) * (0.38 + wave * 0.48);
      const reach = REACH * (0.8 + 0.4 * rand());

      const left = x * STEP - BLEED_X;
      const top = y * STEP - BLEED_Y;
      let t = 1 - Math.abs(y - axis) / reach;
      if (t > 0) t *= behindText(left + CELL / 2, top + CELL / 2);
      if (t < 0.06) continue;

      // Le bleu ne se disperse pas : il prend le cœur du ruban sur une seule
      // portion de la courbe. Éparpillé, il passerait pour une seconde
      // couleur ; groupé, il se lit comme l'endroit où le champ s'emballe.
      const window = smoothstep(clamp01(1 - Math.abs(u - 0.42) / 0.11));
      const tone =
        t > 0.8 && rand() < 0.7 * window
          ? 5
          : t > 0.86
            ? 0
            : t > 0.6
              ? 1
              : t > 0.4
                ? 2
                : t > 0.22
                  ? 3
                  : 4;

      // L'alpha n'achève que la frange : le dégradé principal est porté par la
      // rampe, plus net à l'œil qu'un aplat unique en transparence.
      const [r, g, b] = RGB[tone];
      const alpha = Math.min(1, 0.25 + t * 1.3);
      cells.push({
        left,
        top,
        tone,
        alpha,
        fill: `rgba(${r},${g},${b},${alpha.toFixed(3)})`,
      });
    }
  }
  return cells;
}
