import { ImageResponse } from "next/og";
import { ShadcnRegistry6 } from "@/components/og/shadcn-registry-6";
import { hero, site } from "@/lib/content";
import { monogram, OG_SIZE, ogFonts } from "@/lib/og";

export const alt = `${site.name} — ${site.role}`;
export const size = OG_SIZE;
export const contentType = "image/png";

/**
 * Image de partage de l'accueil, et de toute page qui n'en déclare pas.
 *
 * Gabarit Shadcn Registry 6 d'ogimagecn. Le logo est le monogramme du favicon,
 * noir sur une plaque blanche aux angles arrondis — c'est la forme que le
 * gabarit dessine lui-même quand on ne lui en donne pas.
 */
export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", fontFamily: "Inter Tight" }}>
        <ShadcnRegistry6
          brand={site.name}
          title={site.role}
          description={hero.standfirst}
          logo={monogram({ shape: "square", background: "#ffffff", foreground: "#000000" })}
        />
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
