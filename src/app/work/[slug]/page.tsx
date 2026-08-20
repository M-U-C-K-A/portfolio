import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WorkCard } from "@/components/work-card";
import { Badge } from "@/components/ui/badge";
import {
  projectBySlug,
  projects,
  site,
  type CaseBlock,
  type CaseSection,
  type ProjectImage,
} from "@/lib/content";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/work/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = projectBySlug.get(slug);
  if (!project) return {};

  const title = `${project.title} — ${project.tagline}`;
  return {
    title,
    description: project.summary,
    openGraph: {
      title: `${title} — ${site.name}`,
      description: project.summary,
      type: "article",
      url: `${site.url}/work/${project.slug}`,
    },
  };
}

function Block({ block }: { block: CaseBlock }) {
  if (block.type === "list") {
    return (
      <ul className="flex flex-col gap-2.5">
        {block.items.map((item) => (
          <li key={item} className="body-text flex gap-3 text-muted-foreground">
            <span aria-hidden className="mt-2 size-1 shrink-0 bg-px-accent" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (block.type === "note") {
    return (
      <p className="body-text border-l-2 border-px-accent bg-secondary/60 px-4 py-3">
        {block.text}
      </p>
    );
  }

  return <p className="body-text text-muted-foreground">{block.text}</p>;
}

function CaseSectionView({ section }: { section: CaseSection }) {
  return (
    <div className="grid gap-4 border-t border-rule py-8 md:grid-cols-12 md:gap-10">
      <h2 className="label text-muted-foreground md:col-span-3 md:pt-1">
        {section.title}
      </h2>
      <div className="flex max-w-2xl flex-col gap-4 md:col-span-9">
        {section.blocks.map((block, index) => (
          <Block key={index} block={block} />
        ))}
      </div>
    </div>
  );
}

/**
 * La galerie du projet, posée avant le récit.
 *
 * Un cas d'étude fait ici dix sections : reléguer les captures en fin de page
 * revient à ce que personne ne les voie. On montre d'abord, on explique après.
 *
 * Les captures d'application mobile sont hautes et étroites, celles de site
 * larges — d'où deux grilles. À une image par ligne, un écran de téléphone
 * ferait un kilomètre de haut.
 */
function ProjectShots({ shots }: { shots: ProjectImage[] }) {
  if (shots.length === 0) return null;
  const portrait = shots[0].height > shots[0].width;

  return (
    <section className="shell pt-10 md:pt-14">
      <p className="label mb-6 text-muted-foreground">Aperçus</p>
      <div
        className={cn(
          "grid gap-x-5 gap-y-8",
          portrait ? "grid-cols-2 md:grid-cols-4" : "sm:grid-cols-2",
        )}
      >
        {shots.map((image) => (
          <figure key={image.src} className="flex flex-col gap-3">
            <div
              className="bg-grid relative w-full overflow-hidden border border-rule"
              style={{ aspectRatio: `${image.width} / ${image.height}` }}
            >
              <Image
                src={image.src}
                alt=""
                fill
                sizes={
                  portrait
                    ? "(min-width: 768px) 22vw, 45vw"
                    : "(min-width: 640px) 45vw, 92vw"
                }
                className="object-cover"
              />
            </div>
            <figcaption className="body-text text-muted-foreground">
              {image.caption}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export default async function ProjectPage({ params }: PageProps<"/work/[slug]">) {
  const { slug } = await params;
  const project = projectBySlug.get(slug);
  if (!project) notFound();

  const others = projects.filter((item) => item.slug !== project.slug);

  return (
    <>
      <SiteHeader />

      <main id="contenu">
        <div className="shell pb-10 pt-10 md:pt-14">
          <Link
            href="/#projets"
            className="label inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-ink"
          >
            <span aria-hidden>←</span> Tous les projets
          </Link>

          <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-7">
              <h1 className="display display-l">{project.title}</h1>
              <p className="display display-m mt-2 text-muted-foreground">
                {project.tagline}
              </p>
            </div>

            <div className="flex flex-col gap-5 lg:col-span-5 lg:border-l lg:border-rule lg:pl-8">
              <p className="body-text max-w-md text-muted-foreground">
                {project.summary}
              </p>
              <dl className="grid grid-cols-2 gap-4 border-t border-rule pt-4">
                <div>
                  <dt className="label text-muted-foreground">Rôle</dt>
                  <dd className="body-text mt-1">{project.role}</dd>
                </div>
                <div>
                  <dt className="label text-muted-foreground">Période</dt>
                  <dd className="body-text mt-1">{project.year}</dd>
                </div>
              </dl>
              <ul className="flex flex-wrap gap-1.5">
                {project.stack.map((tech) => (
                  <li key={tech}>
                    <Badge
                      variant="outline"
                      className="label h-auto border-rule px-2 py-1 text-muted-foreground"
                    >
                      {tech}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <figure>
          <div className="bg-grid relative h-[34vh] min-h-[200px] border-y border-rule md:h-[46vh]">
            {/* `alt=""` : la légende juste dessous dit déjà ce que l'image
                montre, et le titre du projet la précède de trois lignes. */}
            <Image
              src={project.cover.src}
              alt=""
              fill
              sizes="100vw"
              preload
              className="object-cover"
            />
          </div>
          <figcaption className="shell label pt-3 text-muted-foreground">
            {project.cover.caption}
          </figcaption>
        </figure>

        {project.status ? (
          <div className="shell pt-10">
            <p className="body-text max-w-2xl border-l-2 border-px-accent bg-secondary/60 px-4 py-3">
              <span className="label mr-2 text-px-accent">Statut</span>
              {project.status}
            </p>
          </div>
        ) : null}

        <ProjectShots shots={project.shots} />

        <div className="shell py-10 md:py-14">
          {project.sections.map((section) => (
            <CaseSectionView key={section.title} section={section} />
          ))}
        </div>

        <section className="shell border-t border-rule py-16 md:py-20">
          <p className="label mb-10 text-muted-foreground">Autres projets</p>
          <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
            {others.map((item) => (
              <WorkCard key={item.slug} project={item} />
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
