import { coverTiles, coverTones, type CoverMotif } from "@/lib/project-cover";
import { cn } from "@/lib/utils";

interface ProjectCoverProps {
  motif: CoverMotif;
  seed: number;
  /** Dimensions de la grille, en cellules. Choisies pour le cadre à remplir. */
  cols: number;
  rows: number;
  className?: string;
}

/**
 * Couverture d'un projet, en SVG rendu sur le serveur.
 *
 * Le `viewBox` est en cellules, donc la composition s'étire sans que le calcul
 * change, et `slice` garde le pavage carré en recadrant ce qui dépasse. Les
 * tuiles laissent un mince jour entre elles : c'est ce qui les fait lire comme
 * une mosaïque plutôt que comme des aplats fondus les uns dans les autres.
 */
export function ProjectCover({
  motif,
  seed,
  cols,
  rows,
  className,
}: ProjectCoverProps) {
  const tiles = coverTiles({ motif, seed, cols, rows });
  const tones = coverTones(motif);

  return (
    <svg
      viewBox={`0 0 ${cols} ${rows}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      className={cn("block size-full", className)}
    >
      {tiles.map((tile, index) => (
        <rect
          key={index}
          x={tile.x + 0.06}
          y={tile.y + 0.06}
          width={tile.w - 0.12}
          height={tile.h - 0.12}
          fill={tones[tile.tone]}
        />
      ))}
    </svg>
  );
}
