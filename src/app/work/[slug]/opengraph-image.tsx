import { ImageResponse } from "next/og";
import { Shiori } from "@/components/og/shiori";
import { projectBySlug, projects, site } from "@/lib/content";
import { monogram, OG_SIZE, ogFonts } from "@/lib/og";
import { paletteOf } from "@/lib/project-cover";

export const alt = `Cas d’étude — ${site.name}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

/**
 * Image de partage d'un cas d'étude.
 *
 * Gabarit Shiori d'ogimagecn, sur la couleur du projet — la même que son
 * bandeau, donc la même que le lecteur retrouve en arrivant sur la page. Le
 * texte suit la palette : blanc sur les fonds soutenus, encre sur l'or.
 */
export default async function ProjectImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = projectBySlug.get(slug);
  if (!project) throw new Error(`Projet inconnu : ${slug}`);

  const palette = paletteOf(project.motif);
  const light = palette.bannerText === "#ffffff";

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", fontFamily: "Inter Tight" }}>
        <Shiori
          background={palette.banner}
          brand={project.title}
          brandColor={palette.bannerText}
          title={project.tagline}
          // Atténué comme dans le gabarit, mais sans passer sous 3:1 — le seuil
          // des grands corps, que le titre dépasse largement à 48 px et plus.
          titleColor={light ? "rgba(255,255,255,0.74)" : "rgba(15,15,17,0.7)"}
          logo={monogram({
            shape: "circle",
            background: palette.bannerText,
            foreground: palette.banner,
          })}
        />
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
