/**
 * La marque imprimée du CV.
 *
 * Une image fixe ne peut pas rejouer un motif animé : figée, la pluie du pied
 * de page ne ressemble qu'à des traits épars, elle a besoin du mouvement pour
 * se lire. On imprime donc ce qui est déjà une *composition* et non une image
 * d'animation — l'explosion, le geste qui donne son sujet au site.
 *
 * Le calcul se fait sur le serveur, à partir des fonctions du moteur, et sort
 * des rectangles que la page rend en SVG : l'impression masque les canvas, et
 * un canvas monté pour le seul papier resterait de taille nulle à l'écran,
 * donc jamais peint.
 */

// Extension explicite : le runner de tests passe par le résolveur ESM de Node,
// qui n'ajoute pas d'extension tout seul.
import { stampBlast, type PixelFrame } from "./pixel-engine.ts";
import { buildPixelFields } from "./pixel-noise.ts";

export interface PixelRun {
  /** Coordonnées et largeur en cellules, pas en pixels. */
  x: number;
  y: number;
  w: number;
  /** Index dans la palette. */
  c: number;
}

export interface BlastMarkOptions {
  cols: number;
  rows: number;
  seed?: number;
  clumpScale?: number;
  /** Centre du disque, en cellules — il peut tomber hors du cadre. */
  cx?: number;
  cy?: number;
  /** Rayon, en cellules. */
  radius?: number;
}

export function buildBlastMark({
  cols,
  rows,
  seed = 95,
  clumpScale = 7,
  cx = cols / 2,
  cy = rows / 2,
  radius = Math.min(cols, rows) / 2,
}: BlastMarkOptions): PixelRun[] {
  const fields = buildPixelFields(cols, rows, seed, clumpScale);
  const frame: PixelFrame = {
    cols,
    rows,
    energy: new Float32Array(cols * rows),
    color: new Uint8Array(cols * rows),
    fields,
  };

  // `progress` à 0 : le disque est capté à sa pleine amplitude, sans la
  // retombée qui sert à le faire disparaître à l'écran.
  stampBlast(frame, cx, cy, radius, 0);

  return mergeRuns(frame);
}

/**
 * Fusionne les cellules voisines de même couleur, comme le fait le canvas :
 * le cœur du disque devient une poignée de rectangles au lieu d'un par
 * cellule, et le SVG reste léger.
 */
function mergeRuns({ cols, rows, energy, color, fields }: PixelFrame) {
  const { mask } = fields;
  const runs: PixelRun[] = [];

  for (let y = 0; y < rows; y++) {
    const rowOffset = y * cols;
    let runColor = -1;
    let runStart = 0;

    for (let x = 0; x < cols; x++) {
      const i = rowOffset + x;
      const c = energy[i] > mask[i] ? color[i] : -1;
      if (c === runColor) continue;
      if (runColor >= 0) {
        runs.push({ x: runStart, y, w: x - runStart, c: runColor });
      }
      runColor = c;
      runStart = x;
    }

    if (runColor >= 0) {
      runs.push({ x: runStart, y, w: cols - runStart, c: runColor });
    }
  }

  return runs;
}
