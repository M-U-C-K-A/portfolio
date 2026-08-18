import type { MetadataRoute } from "next";
import { getAllArticles } from "@/lib/articles";
import { projects, site } from "@/lib/content";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getAllArticles();
  const now = new Date();

  return [
    { url: site.url, lastModified: now, changeFrequency: "monthly", priority: 1 },
    {
      url: `${site.url}/articles`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${site.url}/cv`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.7,
    },
    ...projects.map((project) => ({
      url: `${site.url}/work/${project.slug}`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.9,
    })),
    ...articles.map((article) => ({
      url: `${site.url}/articles/${article.slug}`,
      // La date du frontmatter fait foi : elle ne bouge pas à chaque build.
      lastModified: new Date(article.date),
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
  ];
}
