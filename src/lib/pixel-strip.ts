/**
 * Rappel imprimé du champ de pixels.
 *
 * L'impression masque les `<canvas>`, et un canvas monté pour le seul papier
 * ne serait de toute façon jamais dimensionné à l'écran, donc jamais peint. On
 * rejoue donc la pluie hors écran — mêmes fonctions et même graine que le
 * moteur — et on la sort en rectangles, que la page rend en SVG.
 */

// Extension explicite : le runner de tests passe par le résolveur ESM de Node,
// qui n'ajoute pas d'extension tout seul.
import { decayField, rainStep, type PixelFrame } from "./pixel-engine.ts";
import { buildPixelFields } from "./pixel-noise.ts";

export interface PixelRun {
  /** Coordonnées et largeur en cellules, pas en pixels. */
  x: number;
  y: number;
  w: number;
  /** Index dans la palette. */
  c: number;
}

export interface RainStripOptions {
  cols: number;
  rows: number;
  seed?: number;
  clumpScale?: number;
  /** Durée simulée avant la capture, en millisecondes. */
  duration?: number;
}

/** Pas de simulation : la valeur d'une image à 60 Hz. */
const DT = 16;
/** Durée de vie d'une cellule pleine, alignée sur le moteur. */
const LIFE = 2600;

export function buildRainStrip({
  cols,
  rows,
  seed = 95,
  clumpScale = 7,
  duration = 5200,
}: RainStripOptions): PixelRun[] {
  const { mask, grain } = buildPixelFields(cols, rows, seed, clumpScale);
  const frame: PixelFrame = {
    cols,
    rows,
    energy: new Float32Array(cols * rows),
    color: new Uint8Array(cols * rows),
    mask,
    grain,
  };

  // Le champ démarre vide : sans quelques secondes d'avance, on capturerait
  // les premières gouttes et l'image serait bien plus creuse qu'à l'écran.
  for (let clock = DT; clock <= duration; clock += DT) {
    decayField(frame.energy, grain, DT, LIFE);
    rainStep(frame, clock, DT);
  }

  return mergeRuns(frame);
}

/**
 * Fusionne les cellules voisines de même couleur, comme le fait le canvas :
 * une traînée verticale devient une poignée de rectangles au lieu d'un par
 * cellule, et le SVG reste léger.
 */
function mergeRuns({ cols, rows, energy, color, mask }: PixelFrame) {
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
