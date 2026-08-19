import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { site } from "@/lib/content";
import { HEIGHT, WIDTH, waveSvgDataUri } from "@/lib/og-wave";

export const alt = `${site.name} — ${site.role}`;
export const size = { width: WIDTH, height: HEIGHT };
export const contentType = "image/png";

// Satori n'a pas accès aux polices du site : il faut lui passer les fichiers.
// Sous-ensemble latin + accents français, 44 ko par graisse, là où la fonte
// complète en pèse 300 — le bundle d'une image est plafonné à 500 ko.
const FONT_DIR = join(process.cwd(), "assets/fonts");
const [regular, semibold] = await Promise.all([
  readFile(join(FONT_DIR, "InterTight-Regular.ttf")),
  readFile(join(FONT_DIR, "InterTight-SemiBold.ttf")),
]);

/**
 * Image de partage. L'ancien site en générait une à la volée ; sans elle, les
 * liens partagés arrivent sans vignette. Rendue au build, une seule fois.
 *
 * Le champ de pixels vient de `og-wave.ts`, qui décide aussi de son
 * effacement sous chaque bloc de texte. Les rectangles y sont codés en dur :
 * si l'un des blocs ci-dessous change de taille ou de place, il faut les y
 * reporter.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#fafaf8",
          color: "#0f0f11",
          fontFamily: "Inter Tight",
          padding: "56px 72px",
        }}
      >
        <img
          src={waveSvgDataUri()}
          alt=""
          width={WIDTH}
          height={HEIGHT}
          style={{ position: "absolute", top: 0, left: 0 }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            fontSize: 22,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#6e6e72",
          }}
        >
          {site.location}
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "flex-end",
            alignItems: "flex-end",
            paddingBottom: 24,
          }}
        >
          {site.name.split(" ").map((word) => (
            <div
              key={word}
              style={{
                display: "flex",
                fontSize: 132,
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
