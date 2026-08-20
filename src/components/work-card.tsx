import Image from "next/image";
import Link from "next/link";
import type { Project } from "@/lib/content";

export function WorkCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/work/${project.slug}`}
      className="group flex flex-col gap-4 outline-none"
    >
      <div className="bg-grid relative aspect-[4/3] w-full overflow-hidden border border-rule transition-colors group-hover:border-ink group-focus-visible:border-ink">
        {/* `alt=""` : le titre et le résumé suivent immédiatement, la vignette
            n'ajoute rien qu'un lecteur d'écran doive entendre deux fois. */}
        <Image
          src={project.cover.src}
          alt=""
          fill
          sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 92vw"
          className="object-cover"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="label-justified label text-muted-foreground">
          <span>{project.year}</span>
          <span>{project.stack[0]}</span>
        </div>
        <h3 className="text-base font-medium leading-tight tracking-tight">
          {project.title}
          <span className="text-muted-foreground"> — {project.tagline}</span>
        </h3>
        <p className="body-text text-muted-foreground">{project.summary}</p>
        <span className="label mt-1 inline-flex items-center gap-1.5 text-ink">
          Lire le cas d’étude
          <span
            aria-hidden
            className="transition-transform group-hover:translate-x-1"
          >
            →
          </span>
        </span>
      </div>
    </Link>
  );
}
