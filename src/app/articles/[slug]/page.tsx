import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleList } from "@/components/article-list";
import { ArticleToc } from "@/components/article-toc";
import { PixelField } from "@/components/pixel-field";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import {
  formatArticleDate,
  getAllArticles,
  getArticle,
  getArticleSlugs,
} from "@/lib/articles";
import { site } from "@/lib/content";

export async function generateStaticParams() {
  const slugs = await getArticleSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/articles/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return {};

  return {
    title: article.title,
    description: article.description,
    openGraph: {
      title: `${article.title} — ${site.name}`,
      description: article.description,
      type: "article",
      publishedTime: article.date,
      url: `${site.url}/articles/${article.slug}`,
    },
  };
}

export default async function ArticlePage({
  params,
}: PageProps<"/articles/[slug]">) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  // Trois suggestions, pas la liste entière : on privilégie celles qui
  // partagent un tag, puis on complète par les plus récentes.
  const pool = (await getAllArticles()).filter((item) => item.slug !== slug);
  const related = pool.filter((item) =>
    item.tags.some((tag) => article.tags.includes(tag)),
  );
  const others = [...related, ...pool.filter((item) => !related.includes(item))]
    .slice(0, 3);

  return (
    <>
      <SiteHeader />

      <main id="contenu" className="grow">
        {/* Même largeur que le corps de l'article : l'en-tête et le texte
            forment un seul bloc centré, sans décrochage à mi-page. */}
        <div className="shell mx-auto max-w-[68rem] pb-10 pt-10 md:pt-14">
          <Link
            href="/articles"
            className="label inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-ink"
          >
            <span aria-hidden>←</span> Tous les articles
          </Link>

          <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-8">
              <h1 className="display display-l">{article.title}</h1>
              <p className="body-text-l mt-6 max-w-2xl text-muted-foreground">
                {article.description}
              </p>
            </div>

            <div className="flex flex-col gap-4 lg:col-span-3 lg:col-start-10 lg:pt-2">
              <div className="label-justified label border-t border-rule pt-3 text-muted-foreground">
                <span>{formatArticleDate(article.date)}</span>
                <span>{article.readingMinutes} min</span>
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {article.tags.map((tag) => (
                  <li key={tag}>
                    <Badge
                      variant="outline"
                      className="label h-auto border-rule px-2 py-1 text-muted-foreground"
                    >
                      {tag}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="border-y border-rule">
          <PixelField
            motif="scan"
            cell={6}
            seed={article.slug.length * 137 + 11}
            className="bg-grid h-24 w-full md:h-32"
          />
        </div>

        <div className="shell py-12 md:py-16">
          {/* Trois colonnes dont la dernière reste vide : elle équilibre celle
              du sommaire, si bien que la colonne de texte tombe au centre
              optique de la page au lieu d'être plaquée à gauche. */}
          <div className="mx-auto max-w-[68rem] lg:grid lg:grid-cols-[11rem_minmax(0,40rem)_11rem] lg:gap-x-12">
            {article.headings.length > 2 ? (
              <div className="mb-10 lg:mb-0">
                <ArticleToc headings={article.headings} />
              </div>
            ) : null}

            <article
              className="article"
              dangerouslySetInnerHTML={{ __html: article.html }}
            />
          </div>
        </div>

        {others.length ? (
          <section className="border-t border-rule py-16 md:py-20">
            <div className="shell mx-auto max-w-[68rem]">
              <p className="label mb-10 text-muted-foreground">À lire ensuite</p>
              <ArticleList articles={others} />
            </div>
          </section>
        ) : null}
      </main>

      <SiteFooter />
    </>
  );
}
