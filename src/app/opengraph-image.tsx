import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { site } from "@/lib/content";
import { PIXEL_PALETTE } from "@/lib/pixel-engine";
import { mulberry32 } from "@/lib/pixel-noise";

export const alt = `${site.name} — ${site.role}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Satori n'a pas accès aux polices du site : il faut lui passer les fichiers.
// Sous-ensemble latin + accents français, 44 ko par graisse, là où la fonte
// complète en pèse 300 — le bundle d'une image est plafonné à 500 ko.
const FONT_DIR = join(process.cwd(), "assets/fonts");
const [regular, semibold] = await Promise.all([
  readFile(join(FONT_DIR, "InterTight-Regular.ttf")),
  readFile(join(FONT_DIR, "InterTight-SemiBold.ttf")),
]);

const COLS = 22;
const ROWS = 8;
/** Côté d'une cellule et espace entre deux, en px de l'image. */
const CELL = 13;
const GAP = 4;

/**
 * Le ruban de `motifFlow`, figé.
 *
 * Mêmes harmoniques que le canvas : deux sinusoïdes de périodes
 * incommensurables donnent la courbe, et la distance à son axe choisit le ton.
 * Le tirage est semé, donc l'image est identique d'un build à l'autre — sinon
 * la vignette changerait à chaque déploiement.
 */
function waveGrid() {
  const rand = mulberry32(0x0c7a);
  const rows: (string | null)[][] = [];

  for (let y = 0; y < ROWS; y++) {
    const row: (string | null)[] = [];
    for (let x = 0; x < COLS; x++) {
      const u = x / (COLS - 1);
      const wave = Math.sin(u * 9.6 + 0.4) * 0.6 + Math.sin(u * 4.1 + 2) * 0.26;
      // Amplitude large et ruban mince : c'est l'écart entre les deux qui
      // fait lire une courbe plutôt qu'une bande épaisse.
      const axis = (ROWS - 1) * (0.5 + wave * 0.46);
      const d = Math.abs(y - axis);

      // Quelques cellules du cœur seulement virent à l'accent : le bleu doit
      // se lire comme un accident, pas comme une seconde couleur.
      if (d < 0.9 && rand() < 0.075) {
        row.push(PIXEL_PALETTE[5]);
        continue;
      }
      // Le bord s'effrite : sans ce tirage la bande aurait un contour net et
      // ne ressemblerait plus au champ de pixels du site.
      const tone =
        d < 0.5
          ? 0
          : d < 1.15
            ? 1
            : d < 1.8
              ? 3
              : d < 2.4 && rand() < 0.5
                ? 4
                : null;
      row.push(tone === null ? null : PIXEL_PALETTE[tone]);
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Image de partage. L'ancien site en générait une à la volée ; sans elle, les
 * liens partagés arrivent sans vignette. Rendue au build, une seule fois.
 */
export default function OpengraphImage() {
  const grid = waveGrid();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fafaf8",
          color: "#0f0f11",
          fontFamily: "Inter Tight",
          padding: "56px 72px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: GAP }}>
            {grid.map((row, y) => (
              <div key={y} style={{ display: "flex", gap: GAP }}>
                {row.map((fill, x) => (
                  <div
                    key={x}
                    style={{
                      width: CELL,
                      height: CELL,
                      background: fill ?? "transparent",
                    }}
                  />
                ))}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 22,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: "#6e6e72",
            }}
          >
            {site.location}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {site.name.split(" ").map((word) => (
            <div
              key={word}
              style={{
                display: "flex",
                fontSize: 124,
                fontWeight: 600,
                letterSpacing: -5,
                lineHeight: 1,
                textTransform: "uppercase",
              }}
            >
              {word}
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            borderTop: "1px solid rgba(15,15,17,0.16)",
            paddingTop: 28,
            fontSize: 26,
          }}
        >
          <div style={{ display: "flex", fontWeight: 600 }}>{site.role}</div>
          <div style={{ display: "flex", color: "#6e6e72" }}>
            {site.url.replace("https://www.", "")}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter Tight", data: regular, weight: 400, style: "normal" },
        { name: "Inter Tight", data: semibold, weight: 600, style: "normal" },
      ],
    },
  );
}
