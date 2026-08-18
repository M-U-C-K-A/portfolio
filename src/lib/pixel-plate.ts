/**
 * Vignettes génératives des projets.
 *
 * Plutôt que des captures d'écran, chaque projet reçoit une composition de
 * pixels dérivée de sa graine : deux projets n'ont jamais la même image, et la
 * même graine redonne toujours exactement la même. Le rendu réutilise le masque
 * bruité du moteur principal, donc le même langage visuel — des amas, pas un
 * damier.
 *
 * La composition est *cuite* une fois (`createPlate`) puis simplement seuillée
 * à chaque image (`paintPlate`) : l'animation de survol ne réalloue rien.
 */

import { mulberry32, buildPixelFields, type PixelFields } from "./pixel-noise.ts";
import type { PixelPalette } from "./pixel-engine.ts";

export interface PlateOptions {
  width: number;
  height: number;
  cell: number;
  seed: number;
  palette: PixelPalette;
}

export interface Plate {
  cols: number;
  rows: number;
  cell: number;
  width: number;
  height: number;
  palette: PixelPalette;
  fields: PixelFields;
  /** Énergie de la composition au repos. */
  base: Float32Array;
  /** Couleur de chaque cellule. */
  colors: Uint8Array;
  centreX: number;
  centreY: number;
  revealRadius: number;
}

interface Disc {
  cx: number;
  cy: number;
  r: number;
  color: number;
  edge: number;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Index du rouge et bornes des neutres dans `PIXEL_PALETTE`. */
const RED_INDEX = 5;
const NEUTRAL_MAX = 4;

export function createPlate({
  width,
  height,
  cell,
  seed,
  palette,
}: PlateOptions): Plate {
  const cols = Math.max(1, Math.ceil(width / cell));
  const rows = Math.max(1, Math.ceil(height / cell));
  const count = cols * rows;

  const rand = mulberry32(seed);
  const fields = buildPixelFields(cols, rows, seed, 6);
  const short = Math.min(cols, rows);

  // Trois disques : deux neutres pris dans la rampe pour la masse, un rouge
  // pour l'accent. L'ordre de tirage dépend de la graine, donc la composition
  // aussi — et l'écart entre les deux neutres garantit un contraste lisible.
  const discs: Disc[] = [];
  const darker = Math.floor(rand() * 2); // encre ou ardoise
  const lighter = 2 + Math.floor(rand() * 3); // gris moyen à gris clair
  const palettePlan = [darker, lighter, RED_INDEX].sort(() => rand() - 0.5);
  for (let i = 0; i < 3; i++) {
    discs.push({
      cx: cols * (0.2 + rand() * 0.6),
      cy: rows * (0.2 + rand() * 0.6),
      r: short * (0.3 + rand() * 0.34),
      color: palettePlan[i],
      edge: 1.35 + rand() * 0.75,
    });
  }

  // Bande diagonale lente : évite que la composition paraisse centrée.
  const bandAngle = rand() * Math.PI;
  const bandCos = Math.cos(bandAngle);
  const bandSin = Math.sin(bandAngle);

  const base = new Float32Array(count);
  const colors = new Uint8Array(count);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      let amp = 0;
      let color = 0;

      for (let d = 0; d < discs.length; d++) {
        const disc = discs[d];
        const dx = x + 0.5 - disc.cx;
        const dy = y + 0.5 - disc.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > disc.r) continue;
        const value = clamp01((1 - dist / disc.r) * disc.edge);
        if (value > amp) {
          amp = value;
          color = disc.color;
        }
      }

      const band = 0.5 + 0.5 * Math.sin((x * bandCos + y * bandSin) * 0.14);
      // Modulation par l'*inverse* de l'amas : le masque monte avec l'amas, donc
      // injecter moins d'énergie là où le seuil est haut creuse de vrais trous
      // au lieu de les compenser.
      amp *= (0.4 + 0.72 * (1 - fields.clump[i])) * (0.55 + 0.5 * band);

      // Les neutres se décalent d'un cran selon l'amas : la masse gagne des
      // bandes de tons au lieu d'être un aplat.
      if (color !== RED_INDEX) {
        const clump = fields.clump[i];
        const shift = clump < 0.34 ? -1 : clump > 0.7 ? 1 : 0;
        const shifted = color + shift;
        color = shifted < 0 ? 0 : shifted > NEUTRAL_MAX ? NEUTRAL_MAX : shifted;
      }

      base[i] = amp;
      colors[i] = color;
    }
  }

  return {
    cols,
    rows,
    cell,
    width,
    height,
    palette,
    fields,
    base,
    colors,
    centreX: cols * 0.5,
    centreY: rows * 0.5,
    revealRadius: Math.max(cols, rows) * 0.72,
  };
}

/**
 * Peint la vignette. `reveal` (0 → 1) fait grandir un disque supplémentaire au
 * centre : c'est ce qui densifie la composition au survol de la carte.
 */
export function paintPlate(
  ctx: CanvasRenderingContext2D,
  plate: Plate,
  reveal = 0,
) {
  const { cols, rows, cell, base, colors, palette, fields } = plate;
  const { mask, clump } = fields;
  ctx.clearRect(0, 0, plate.width, plate.height);

  const revealR = plate.revealRadius * reveal;
  const revealR2 = revealR * revealR;
  const active = reveal > 0.001;

  let lastFill = "";

  for (let y = 0; y < rows; y++) {
    const rowOffset = y * cols;
    const dy = y + 0.5 - plate.centreY;
    const dy2 = dy * dy;
    let runColor = -1;
    let runStart = 0;

    for (let x = 0; x < cols; x++) {
      const i = rowOffset + x;
      let amp = base[i];
      let color = colors[i];

      if (active) {
        const dx = x + 0.5 - plate.centreX;
        const d2 = dx * dx + dy2;
        if (d2 < revealR2) {
          const edge = 1 - Math.sqrt(d2) / revealR;
          const boost = clamp01(edge * 1.9) * (0.6 + (1 - clump[i]) * 0.7);
          if (boost > amp) {
            amp = boost;
            color = RED_INDEX;
          }
        }
      }

      const lit = amp > mask[i];
      const next = lit ? color : -1;
      if (next === runColor) continue;

      if (runColor >= 0) {
        const fill = palette[runColor];
        if (fill !== lastFill) {
          ctx.fillStyle = fill;
          lastFill = fill;
        }
        ctx.fillRect(runStart * cell, y * cell, (x - runStart) * cell, cell);
      }
      runColor = next;
      runStart = x;
    }

    if (runColor >= 0) {
      const fill = palette[runColor];
      if (fill !== lastFill) {
        ctx.fillStyle = fill;
        lastFill = fill;
      }
      ctx.fillRect(runStart * cell, y * cell, (cols - runStart) * cell, cell);
    }
  }
}
