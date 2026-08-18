import Link from "next/link";
import { ArticleList } from "@/components/article-list";
import { Section } from "@/components/section";
import { getAllArticles } from "@/lib/articles";
import { writingSection } from "@/lib/content";

/** Nombre d'articles mis en avant sur l'accueil. */
const PREVIEW_COUNT = 3;

export async function Writing() {
  const articles = await getAllArticles();
  const preview = articles.slice(0, PREVIEW_COUNT);
  const remaining = articles.length - preview.length;

  return (
    <Section id="articles" eyebrow="Les articles">
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
        <h2 className="display display-l lg:col-span-5">
          {writingSection.headline}
        </h2>
        <p className="body-text max-w-xl text-muted-foreground lg:col-span-6 lg:col-start-7 lg:pt-2">
          {writingSection.lead}
        </p>
      </div>

      <ArticleList articles={preview} className="mt-12 md:mt-16" />

      {remaining > 0 ? (
        <Link
          href="/articles"
          className="group label mt-8 inline-flex items-center gap-2 border border-ink px-4 py-3 text-ink transition-colors hover:bg-ink hover:text-paper"
        >
          Voir les {articles.length} articles
          <span
            aria-hidden
            className="transition-transform group-hover:translate-x-1"
          >
            →
          </span>
        </Link>
      ) : null}
    </Section>
  );
}
