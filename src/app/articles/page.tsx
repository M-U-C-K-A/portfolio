import type { Metadata } from "next";
import { ArticleList } from "@/components/article-list";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getAllArticles } from "@/lib/articles";
import { writingSection } from "@/lib/content";

export const metadata: Metadata = {
  title: "Articles",
  description: writingSection.lead,
};

export default async function ArticlesPage() {
  const articles = await getAllArticles();

  return (
    <>
      <SiteHeader />

      <main id="contenu" className="shell grow pb-16 pt-10 md:pt-14">
        <p className="label text-muted-foreground">Les articles</p>

        <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:gap-10">
          <h1 className="display display-l lg:col-span-6">
            {writingSection.headline}
          </h1>
          <p className="body-text max-w-xl text-muted-foreground lg:col-span-5 lg:col-start-8 lg:pt-2">
            {writingSection.lead}
          </p>
        </div>

        <ArticleList articles={articles} className="mt-12 md:mt-16" />
      </main>

      <SiteFooter />
    </>
  );
}
