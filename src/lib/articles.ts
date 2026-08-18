/**
 * Chargement et rendu des articles.
 *
 * Les articles sont des fichiers markdown dans `content/articles/`. Tout se
 * passe au build : lecture disque, coloration syntaxique et génération du HTML.
 * Rien de tout cela n'atteint le navigateur.
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified, type Plugin } from "unified";
import type { Node, Parent } from "unist";

const ARTICLES_DIR = path.join(process.cwd(), "content", "articles");

export interface ArticleHeading {
  id: string;
  text: string;
}

export interface ArticleMeta {
  slug: string;
  title: string;
  description: string;
  /** Format ISO, tel qu'écrit dans le frontmatter. */
  date: string;
  tags: string[];
  readingMinutes: number;
}

export interface Article extends ArticleMeta {
  html: string;
  headings: ArticleHeading[];
}

// --- Traversée du HTML intermédiaire -----------------------------------------

interface HastElement extends Parent {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  value?: string;
  children: HastElement[];
}

function asElement(node: Node): HastElement {
  return node as HastElement;
}

function textOf(node: HastElement): string {
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(textOf).join("");
}

/** Relève les titres de niveau 2 pour construire le sommaire. */
function collectHeadings(store: ArticleHeading[]): Plugin<[], Node> {
  return () => (tree: Node) => {
    const walk = (node: HastElement) => {
      if (node.tagName === "h2") {
        const id = node.properties?.id;
        if (typeof id === "string") store.push({ id, text: textOf(node) });
      }
      node.children?.forEach(walk);
    };
    walk(asElement(tree));
  };
}

/**
 * Enveloppe les tableaux dans un conteneur défilant : sur mobile, un tableau
 * large doit glisser dans sa propre boîte plutôt que d'élargir la page.
 */
const wrapTables: Plugin<[], Node> = () => (tree: Node) => {
  const walk = (node: HastElement) => {
    const children = node.children;
    if (!children) return;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === "table") {
        children[i] = {
          type: "element",
          tagName: "div",
          properties: { className: ["table-scroll"] },
          children: [child],
        } as HastElement;
      } else {
        walk(child);
      }
    }
  };
  walk(asElement(tree));
};

// --- Lecture -----------------------------------------------------------------

interface Frontmatter {
  title?: unknown;
  description?: unknown;
  date?: unknown;
  tags?: unknown;
}

function parseFrontmatter(slug: string, data: Frontmatter, body: string) {
  const { title, description, date, tags } = data;
  if (typeof title !== "string" || typeof description !== "string") {
    throw new Error(`Article « ${slug} » : titre ou description manquants.`);
  }

  const words = body.split(/\s+/).filter(Boolean).length;

  return {
    slug,
    title,
    description,
    date: typeof date === "string" ? date : "",
    tags: Array.isArray(tags) ? tags.filter((t): t is string => typeof t === "string") : [],
    readingMinutes: Math.max(1, Math.round(words / 200)),
  } satisfies ArticleMeta;
}

export async function getArticleSlugs(): Promise<string[]> {
  const files = await readdir(ARTICLES_DIR);
  return files
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.replace(/\.md$/, ""));
}

/** Métadonnées de tous les articles, du plus récent au plus ancien. */
export async function getAllArticles(): Promise<ArticleMeta[]> {
  const slugs = await getArticleSlugs();
  const articles = await Promise.all(
    slugs.map(async (slug) => {
      const raw = await readFile(path.join(ARTICLES_DIR, `${slug}.md`), "utf8");
      const { data, content } = matter(raw);
      return parseFrontmatter(slug, data as Frontmatter, content);
    }),
  );
  return articles.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getArticle(slug: string): Promise<Article | null> {
  let raw: string;
  try {
    raw = await readFile(path.join(ARTICLES_DIR, `${slug}.md`), "utf8");
  } catch {
    return null;
  }

  const { data, content } = matter(raw);
  const meta = parseFrontmatter(slug, data as Frontmatter, content);
  const headings: ArticleHeading[] = [];

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(collectHeadings(headings))
    .use(wrapTables)
    .use(rehypePrettyCode, {
      // Thème volontairement sobre : le rouge de la page reste le seul accent.
      theme: "min-light",
      // On garde le fond défini dans globals.css plutôt que celui du thème.
      keepBackground: false,
    })
    .use(rehypeStringify)
    .process(content);

  return { ...meta, html: String(file), headings };
}

/** Date longue en français, à partir du format ISO du frontmatter. */
export function formatArticleDate(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}
