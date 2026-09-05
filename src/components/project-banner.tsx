import {
  BANNER_COLS,
  BANNER_ROWS,
  bannerPanels,
  paletteOf,
  type CoverMotif,
} from "@/lib/project-cover";

/**
 * Fond du bandeau d'un cas d'étude.
 *
 * Le titre se pose dessus, en blanc. Les panneaux ne sont que des voiles de
 * quelques pour cent : le contraste du texte doit tenir sur n'importe quel
 * point du bandeau, y compris là où deux panneaux se recouvrent.
 *
 * `preserveAspectRatio="none"` — ce sont de grands aplats abstraits, les
 * étirer ne se voit pas, et cela garantit qu'ils couvrent toute la bande quelle
 * que soit sa hauteur.
 */
export function ProjectBanner({
  motif,
  seed,
}: {
  motif: CoverMotif;
  seed: number;
}) {
  const palette = paletteOf(motif);
  const panels = bannerPanels({ motif, seed });

  return (
    <svg
      viewBox={`0 0 ${BANNER_COLS} ${BANNER_ROWS}`}
      preserveAspectRatio="none"
      aria-hidden
      className="absolute inset-0 size-full"
    >
      <rect width={BANNER_COLS} height={BANNER_ROWS} fill={palette.banner} />
      {panels.map((panel, index) => (
        <rect
          key={index}
          x={panel.x}
          y={panel.y}
          width={panel.w}
          height={panel.h}
          fill={panel.tint > 0 ? "#ffffff" : "#000000"}
          opacity={Math.abs(panel.tint)}
        />
      ))}
    </svg>
  );
}
