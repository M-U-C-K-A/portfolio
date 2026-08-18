import { cn } from "@/lib/utils";

/** Petite marque en pixels — les initiales HD réduites à une grille 7×5. */
const CELLS = [
  [1, 0, 1, 0, 1, 1, 0],
  [1, 0, 1, 0, 1, 0, 1],
  [1, 1, 1, 0, 1, 0, 1],
  [1, 0, 1, 0, 1, 0, 1],
  [1, 0, 1, 0, 1, 1, 0],
];

export function PixelMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 7 5"
      shapeRendering="crispEdges"
      role="img"
      aria-label="Hugo Delacour"
      className={cn("h-3 w-auto", className)}
    >
      {CELLS.flatMap((row, y) =>
        row.map((on, x) =>
          on ? (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" />
          ) : null,
        ),
      )}
    </svg>
  );
}
