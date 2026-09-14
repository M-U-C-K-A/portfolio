import { ImageResponse } from "next/og";
import { Shiori } from "@/components/og/shiori";
import { getAllArticles, getArticleSlugs } from "@/lib/articles";
import { site } from "@/lib/content";
import { monogram, OG_SIZE, ogFonts } from "@/lib/og";

export const alt = `Article — ${site.name}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export async function generateStaticParams() {
  const slugs = await getArticleSlugs();
  return slugs.map((slug) => ({ slug }));
}

/**
 * Image de partage d'un article.
 *
 * Gabarit Shiori d'ogimagecn, comme les cas d'étude. Un article n'a pas de
 * couleur à lui : il prend le papier et l'encre du site, et c'est la couleur
 * qui distingue d'un coup d'œil un projet d'un texte.
 *
 * La liste des articles suffit ici — `getArticle` rendrait tout le markdown
 * pour n'en lire que le titre.
 */
export default async function ArticleImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = (await getAllArticles()).find((item) => item.slug === slug);
  if (!article) throw new Error(`Article inconnu : ${slug}`);

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", fontFamily: "Inter Tight" }}>
        <Shiori
          background="#fafaf8"
          brand={site.name}
          brandColor="#0f0f11"
          title={article.title}
          titleColor="#6e6e72"
          logo={monogram({ shape: "circle", background: "#0f0f11", foreground: "#fafaf8" })}
        />
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
