import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { cookies } from "next/headers";

type Team = {
  name: string;
  role: string;
  avatar: string;
  linkedIn: string;
};

type Metadata = {
  title: string;
  publishedAt: string;
  summary: string;
  image?: string;
  images: string[];
  tag?: string;
  tags?: string[];
  team: Team[];
  link?: string;
};

import { notFound } from "next/navigation";

export type Language = "fr" | "en";

function getMDXFiles(dir: string) {
  if (!fs.existsSync(dir)) {
    notFound();
  }

  return fs.readdirSync(dir).filter((file) => path.extname(file) === ".mdx");
}

function readMDXFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    notFound();
  }

  const rawContent = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(rawContent);

  const metadata: Metadata = {
    title: data.title || "",
    publishedAt: data.publishedAt || data.date,
    summary: data.summary || "",
    image: data.image || "",
    images: data.images || [],
    tag: data.tag || undefined,
    tags: data.tags || [],
    team: data.team || [],
    link: data.link || "",
  };

  return { metadata, content };
}

// Get the base slug without language suffix
function getBaseSlug(filename: string): string {
  const slug = path.basename(filename, ".mdx");
  // Remove .fr or .en suffix if present
  return slug.replace(/\.(fr|en)$/, "");
}

// Get the language from a filename
function getLanguageFromFilename(filename: string): Language | null {
  if (filename.endsWith(".fr.mdx")) return "fr";
  if (filename.endsWith(".en.mdx")) return "en";
  return null;
}

// Group files by base slug
function groupFilesBySlug(files: string[]): Map<string, { fr?: string; en?: string }> {
  const groups = new Map<string, { fr?: string; en?: string }>();

  for (const file of files) {
    const baseSlug = getBaseSlug(file);
    const lang = getLanguageFromFilename(file);

    if (!groups.has(baseSlug)) {
      groups.set(baseSlug, {});
    }

    const group = groups.get(baseSlug)!;
    if (lang === "fr") {
      group.fr = file;
    } else if (lang === "en") {
      group.en = file;
    } else {
      // Fallback for files without language suffix (treat as FR)
      group.fr = file;
    }
  }

  return groups;
}

function getMDXData(dir: string, language: Language = "fr") {
  const mdxFiles = getMDXFiles(dir);
  const groupedFiles = groupFilesBySlug(mdxFiles);

  const posts: Array<{ metadata: Metadata; slug: string; content: string }> = [];

  groupedFiles.forEach((files, baseSlug) => {
    // Strictly prefer the requested language
    const fileToUse = files[language];

    if (fileToUse) {
      const { metadata, content } = readMDXFile(path.join(dir, fileToUse));
      posts.push({
        metadata,
        slug: baseSlug,
        content,
      });
    }
  });

  return posts;
}

export function getPosts(customPath = ["", "", "", ""], language: Language = "fr") {
  const postsDir = path.join(process.cwd(), ...customPath);
  return getMDXData(postsDir, language);
}

// Helper to get language from cookies (for server components)
export async function getLanguageFromCookies(): Promise<Language> {
  try {
    const cookieStore = await cookies();
    const langCookie = cookieStore.get("data-language");
    if (langCookie?.value === "en") return "en";
    return "fr";
  } catch {
    return "fr";
  }
}
