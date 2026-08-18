"use client";

import { useEffect, useState } from "react";
import type { ArticleHeading } from "@/lib/articles";
import { cn } from "@/lib/utils";

/**
 * Sommaire d'article. Il suit la lecture : le titre actif est celui de la
 * section la plus haute encore visible dans le tiers supérieur de l'écran.
 */
export function ArticleToc({ headings }: { headings: ArticleHeading[] }) {
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const targets = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => element !== null);
    if (!targets.length) return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const current = headings.find((heading) => visible.has(heading.id));
        if (current) setActiveId(current.id);
      },
      // Marge basse négative : un titre ne devient actif qu'une fois monté
      // dans le tiers supérieur, pas dès qu'il pointe en bas de l'écran.
      { rootMargin: "-64px 0px -65% 0px" },
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [headings]);

  return (
    <nav aria-label="Sommaire" className="lg:sticky lg:top-16 lg:self-start">
      <p className="label border-b border-rule pb-2 text-muted-foreground">
        Sommaire
      </p>
      <ol className="mt-3 flex flex-col">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              aria-current={activeId === heading.id ? "location" : undefined}
              className={cn(
                "block border-l py-1.5 pl-3 text-[0.8125rem] leading-snug transition-colors",
                activeId === heading.id
                  ? "border-px-accent text-ink"
                  : "border-rule text-muted-foreground hover:text-ink",
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
