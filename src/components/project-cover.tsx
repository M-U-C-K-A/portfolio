import { brickRows, paletteOf, type CoverMotif } from "@/lib/project-cover";
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
 * Vignette d'un projet : un motif de briques dans sa couleur.
 *
 * Deux tons seulement — la couleur sur son propre fond pâle. Un dégradé de gris
 * mêlé à la couleur ferait une image de plus ; deux tons font une signature.
 *
 * Le `viewBox` est en cellules, donc le motif s'étire sans que le calcul
 * change, et `slice` garde les briques rectangulaires en recadrant ce qui
 * dépasse.
 */
export function ProjectCover({
  motif,
  seed,
  cols,
  rows,
  className,
}: ProjectCoverProps) {
  const palette = paletteOf(motif);
  const bricks = brickRows({ motif, seed, cols, rows });

  return (
    <svg
      viewBox={`0 0 ${cols} ${rows}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      className={cn("block size-full", className)}
    >
      <rect width={cols} height={rows} fill={palette.ground} />
      {bricks.map((brick, index) => (
        <rect
          key={index}
          x={brick.x + 0.12}
          y={brick.y + 0.16}
          width={brick.w - 0.24}
          height={0.68}
          fill={palette.bar}
        />
      ))}
    </svg>
  );
}
