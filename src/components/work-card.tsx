import Link from "next/link";
import { ProjectCover } from "@/components/project-cover";
import type { Project } from "@/lib/content";

export function WorkCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/work/${project.slug}`}
      className="group flex flex-col gap-4 outline-none"
    >
      <div className="bg-grid relative aspect-[4/3] w-full overflow-hidden border border-rule transition-colors group-hover:border-ink group-focus-visible:border-ink">
        <ProjectCover motif={project.motif} seed={project.seed} cols={30} rows={22} />
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
