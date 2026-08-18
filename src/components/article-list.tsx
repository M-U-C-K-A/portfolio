import Link from "next/link";
import { formatArticleDate, type ArticleMeta } from "@/lib/articles";
import { cn } from "@/lib/utils";

interface ArticleListProps {
  articles: ArticleMeta[];
  className?: string;
}

/** Liste d'articles en lignes réglées — partagée par l'accueil et /articles. */
export function ArticleList({ articles, className }: ArticleListProps) {
  return (
    <ul className={cn("border-t border-rule", className)}>
      {articles.map((article) => (
        <li key={article.slug}>
          <Link
            href={`/articles/${article.slug}`}
            className="group grid gap-2 border-b border-rule py-6 transition-colors hover:bg-secondary/60 md:grid-cols-12 md:items-baseline md:gap-6 md:px-2"
          >
            <span className="label text-muted-foreground md:col-span-2">
              {formatArticleDate(article.date)}
            </span>
            <span className="label text-px-accent md:col-span-2">
              {article.tags[0]}
            </span>
            <span className="md:col-span-6">
              <span className="block text-base font-medium tracking-tight">
                {article.title}
              </span>
              <span className="body-text mt-1 block text-muted-foreground">
                {article.description}
              </span>
            </span>
            <span className="label flex items-center gap-1.5 text-ink md:col-span-2 md:justify-end">
              {article.readingMinutes} min
              <span
                aria-hidden
                className="transition-transform group-hover:translate-x-1"
              >
                →
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
