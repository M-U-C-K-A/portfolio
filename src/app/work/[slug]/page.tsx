import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectBanner } from "@/components/project-banner";
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
        {/* Le bandeau porte le titre plutôt que de le précéder : c'est la
            couleur du projet qui l'annonce, avant même qu'on lise son nom.
            Le texte y est en blanc plein — les voiles des panneaux éclaircissent
            le fond de quelques pour cent, et le contraste doit tenir au pire
            endroit du bandeau, pas en moyenne. */}
        <header className="relative isolate overflow-hidden">
          <ProjectBanner motif={project.motif} seed={project.seed} />
          <div className="shell relative py-16 md:py-24">
            <Link
              href="/#projets"
              className="label inline-flex items-center gap-1.5 text-white transition-opacity hover:opacity-75"
            >
              <span aria-hidden>←</span> Tous les projets
            </Link>
            <h1 className="display display-l mt-8 max-w-4xl text-white md:mt-12">
              {project.title}
            </h1>
            {/* 0,85 sur du texte de cette taille reste au-dessus de 3:1, le
                seuil des grands corps. Sur le lien ci-dessus, qui fait 10 px,
                il faudrait 4,5:1 — d'où le blanc plein. */}
            <p className="display display-m mt-3 max-w-3xl text-white/85">
              {project.tagline}
            </p>
          </div>
        </header>

        <div className="shell grid gap-8 border-b border-rule pb-10 pt-10 md:pt-14 lg:grid-cols-12 lg:gap-10">
          <p className="body-text-l max-w-2xl lg:col-span-7">{project.summary}</p>

          <div className="flex flex-col gap-5 lg:col-span-5 lg:border-l lg:border-rule lg:pl-8">
            <dl className="grid grid-cols-2 gap-4">
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

        <ProjectShots shots={project.shots} />

        {/* Le chapô prend toute la colonne, sans libellé à sa gauche : c'est ce
            qui le sépare des sections, qui sont toutes en retrait. Le premier
            paragraphe est composé grand et court sur la largeur, les suivants
            se rangent en deux colonnes — la mesure reste lisible et le bloc ne
            ressemble à rien d'autre sur la page. */}
        <div className="shell pt-14 md:pt-20">
          {/* La fonte d'affichage, mais en bas de casse : `.display` passe tout
              en capitales, ce qui va à un titre de trois mots et pas à un
              paragraphe de quarante. L'interlignage de 0,94 est également
              desserré — il est calculé pour des capitales, qui n'ont pas de
              jambages. */}
          <p className="display display-m max-w-5xl normal-case leading-[1.12]">
            {project.intro[0]}
          </p>
          {project.intro.length > 1 ? (
            <div className="mt-8 grid gap-x-10 gap-y-4 md:mt-10 md:grid-cols-2">
              {project.intro.slice(1).map((paragraph, index) => (
                <p key={index} className="body-text text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </div>
          ) : null}
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
