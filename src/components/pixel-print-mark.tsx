import { PIXEL_PALETTE } from "@/lib/pixel-engine";
import { buildBlastMark } from "@/lib/pixel-strip";

/**
 * Résolution de la marque, en cellules. Volontairement basse : à vingt
 * cellules de côté sur 15 mm, un pixel fait près d'un millimètre et se lit
 * encore sur le papier. Plus fin, la trame se refermerait en aplat gris.
 */
const SIDE = 20;

const runs = buildBlastMark({
  cols: SIDE,
  rows: SIDE,
  seed: 95,
  clumpScale: 4,
  cx: SIDE / 2,
  cy: SIDE / 2,
  radius: SIDE / 2 - 1,
});

/**
 * L'explosion, rappelée sur la version imprimée du CV.
 *
 * En SVG et non en `<canvas>` : l'impression masque les canvas, et un canvas
 * réservé au papier resterait de taille nulle à l'écran, donc jamais peint.
 * Le tracé est calculé sur le serveur, rien n'atteint le navigateur.
 */
export function PixelPrintMark() {
  return (
    <svg
      aria-hidden
      role="presentation"
      viewBox={`0 0 ${SIDE} ${SIDE}`}
      className="cv-mark hidden print:block"
    >
      {runs.map((run) => (
        <rect
          key={`${run.y}-${run.x}`}
          x={run.x}
          y={run.y}
          width={run.w}
          height={1}
          fill={PIXEL_PALETTE[run.c]}
        />
      ))}
    </svg>
  );
}
