import { COVER_TONES, coverRuns, type CoverMotif } from "@/lib/project-cover";
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
 * Le `viewBox` est en cellules, donc la couverture s'étire sans que le calcul
 * change, et `slice` garde les pixels carrés en recadrant ce qui dépasse. Les
 * tons sont des jetons CSS : la bascule clair/sombre les inverse toute seule.
 */
export function ProjectCover({
  motif,
  seed,
  cols,
  rows,
  className,
}: ProjectCoverProps) {
  const runs = coverRuns({ motif, seed, cols, rows });

  return (
    <svg
      viewBox={`0 0 ${cols} ${rows}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      className={cn("block size-full", className)}
    >
      {runs.map((run, index) => (
        <rect
          key={index}
          x={run.col + 0.1}
          y={run.row + 0.1}
          width={run.length - 0.2}
          height={0.8}
          fill={COVER_TONES[run.tone]}
        />
      ))}
    </svg>
  );
}
