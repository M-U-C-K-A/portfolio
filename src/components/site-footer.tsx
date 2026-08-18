import Link from "next/link";
import { PixelField } from "@/components/pixel-field";
import { site } from "@/lib/content";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-rule">
      <PixelField
        motif="rain"
        cell={6}
        seed={95}
        className="bg-grid h-24 w-full border-b border-rule md:h-32"
      />

      <div className="shell flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="label text-muted-foreground">
          © {new Date().getFullYear()} {site.name}
        </p>
        <p className="label text-muted-foreground">
          Next.js · TypeScript · Canvas 2D — sans dépendance d’animation
        </p>
        <Link
          href="/#contenu"
          className="label text-ink transition-opacity hover:opacity-60"
        >
          Haut de page ↑
        </Link>
      </div>
    </footer>
  );
}
