import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectCover } from "@/components/project-cover";
import { ProjectShots } from "@/components/project-shots";
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
} from "@/lib/content";

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

        <div className="bg-grid h-[26vh] min-h-[170px] border-y border-rule md:h-[34vh]">
          <ProjectCover motif={project.motif} seed={project.seed} cols={72} rows={20} />
        </div>
        <ProjectShots shots={project.shots} />

        <div className="shell grid gap-4 pt-14 md:grid-cols-12 md:gap-10 md:pt-20">
          <div className="flex max-w-2xl flex-col gap-4 md:col-span-9 md:col-start-4">
            {project.intro.map((paragraph, index) => (
              <p
                key={index}
                className={
                  index === 0 ? "body-text-l" : "body-text text-muted-foreground"
                }
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>

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
