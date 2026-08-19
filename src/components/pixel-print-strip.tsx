import { PIXEL_PALETTE } from "@/lib/pixel-engine";
import { buildRainStrip } from "@/lib/pixel-strip";

/** Côté d'une cellule, en unités du viewBox — l'échelle vient du SVG. */
const COLS = 117;
const ROWS = 18;

/**
 * L'instant de capture n'est pas anodin : les colonnes tirent leur vitesse et
 * leur période du même bruit, si bien que leurs phases se rejoignent autour de
 * t ≈ 289 × rows (ici 5,2 s), où le champ se vide. On capture donc à l'écart
 * de ce nœud, sur une image bien remplie.
 */
const runs = buildRainStrip({ cols: COLS, rows: ROWS, seed: 95, duration: 2320 });

/**
 * Le champ de pixels, rappelé sur la version imprimée du CV.
 *
 * En SVG et non en `<canvas>` : l'impression masque les canvas, et un canvas
 * réservé au papier resterait de taille nulle à l'écran, donc jamais peint.
 * Le tracé est calculé sur le serveur, rien n'atteint le navigateur.
 */
export function PixelPrintStrip() {
  return (
    <div aria-hidden className="cv-strip hidden print:block">
      <div className="bg-grid border-t border-rule">
        <svg
          viewBox={`0 0 ${COLS} ${ROWS}`}
          className="block h-auto w-full"
          role="presentation"
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
      </div>
    </div>
  );
}
