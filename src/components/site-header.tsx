import Link from "next/link";
import { PixelMark } from "@/components/pixel-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { site } from "@/lib/content";

const nav = [
  { href: "/#projets", label: "Projets" },
  { href: "/#points-de-vue", label: "Points de vue" },
  { href: "/#methode", label: "Méthode" },
  { href: "/#parcours", label: "Parcours" },
  { href: "/articles", label: "Articles" },
  { href: "/cv", label: "CV" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/90 backdrop-blur-sm">
      <div className="shell flex h-11 items-center justify-between gap-4">
        <Link
          href="/"
          className="label flex items-center gap-2 text-ink transition-opacity hover:opacity-60"
        >
          <PixelMark className="h-2.5" />
          <span>{site.name}</span>
        </Link>

        <nav aria-label="Navigation principale" className="flex items-center gap-4 sm:gap-6">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="label hidden text-muted-foreground transition-colors hover:text-ink md:inline"
            >
              {item.label}
            </Link>
          ))}
          <ThemeToggle />
          <Link
            href="/#contact"
            className="label border border-ink px-2 py-1 text-ink transition-colors hover:bg-ink hover:text-paper"
          >
            Contact
          </Link>
        </nav>
      </div>
    </header>
  );
}
