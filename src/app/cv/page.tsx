import type { Metadata } from "next";
import Link from "next/link";
import { PixelPrintStrip } from "@/components/pixel-print-strip";
import { PrintButton } from "@/components/print-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { cv, site, type CvEntry } from "@/lib/content";

export const metadata: Metadata = {
  title: "CV",
  description: `Parcours, compétences et stack technique de ${site.name}, ${cv.role.toLowerCase()}.`,
};

function Entries({ entries }: { entries: readonly CvEntry[] }) {
  return (
    <div className="flex flex-col">
      {entries.map((entry) => (
        <article
          key={entry.organisation}
          className="cv-entry border-t border-rule py-5 first:border-t-0 first:pt-0"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
            <h3 className="text-base font-medium tracking-tight">
              {entry.organisation}
            </h3>
            <p className="label shrink-0 text-muted-foreground">
              {entry.period}
            </p>
          </div>
          <p className="label mt-2 text-px-accent">{entry.role}</p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {entry.points.map((point) => (
              <li
                key={point}
                className="body-text flex gap-2.5 text-muted-foreground"
              >
                <span aria-hidden className="mt-2 size-1 shrink-0 bg-ink" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="cv-block border-t border-rule pt-5">
      <h2 className="label mb-4 text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default function CvPage() {
  return (
    <>
      <div className="print:hidden">
        <SiteHeader />
      </div>

      <main id="contenu" className="shell grow pb-20 pt-10 md:pt-14">
        <div className="cv mx-auto max-w-[64rem]">
          {/* En-tête. Sur le papier, la grille se recompose : le nom seul en
              haut, le résumé sous lui et le bloc contact descendu à sa hauteur
              (voir `.cv-head` dans globals.css). */}
          <header className="cv-head grid gap-6 border-b border-rule pb-8 md:grid-cols-12 md:items-end">
            <div className="cv-identity md:col-span-7">
              <p className="label text-muted-foreground print:hidden">
                {cv.specialities.join(" · ")}
              </p>
              <h1 className="display display-l mt-3 print:mt-0">{site.name}</h1>
              <p className="display display-m mt-1 text-muted-foreground">
                {cv.role}
              </p>
            </div>

            <dl className="cv-facts grid grid-cols-2 gap-x-6 gap-y-3 md:col-span-5">
              {cv.facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="label text-muted-foreground">{fact.label}</dt>
                  <dd className="body-text mt-0.5 break-words">
                    {fact.href ? (
                      <a
                        href={fact.href}
                        className="underline decoration-rule underline-offset-4 transition-colors hover:decoration-ink"
                      >
                        {fact.value}
                      </a>
                    ) : (
                      fact.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="cv-summary body-text mt-2 max-w-3xl text-muted-foreground md:col-span-12">
              {cv.summary}
            </p>
          </header>

          {/* Corps : parcours à gauche, compétences à droite */}
          <div className="cv-body mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-12">
            <div className="cv-col flex flex-col gap-10 lg:col-span-7">
              <Block title="Expérience">
                <Entries entries={cv.experience} />
              </Block>

              <Block title="Formation">
                <Entries entries={cv.education} />
              </Block>
            </div>

            <div className="cv-col flex flex-col gap-10 lg:col-span-5">
              <Block title="Projets">
                <ul className="cv-work flex flex-col gap-4">
                  {cv.selectedWork.map((item) => (
                    <li key={item.slug}>
                      <Link
                        href={`/work/${item.slug}`}
                        className="text-base font-medium tracking-tight underline decoration-rule underline-offset-4 transition-colors hover:decoration-px-accent"
                      >
                        {item.name}
                      </Link>
                      <p className="body-text mt-1 text-muted-foreground">
                        {item.text}
                      </p>
                    </li>
                  ))}
                </ul>
              </Block>

              <Block title="Compétences">
                <ul className="flex flex-col gap-4">
                  {cv.competencies.map((item) => (
                    <li key={item.title}>
                      <p className="text-base font-medium tracking-tight">
                        {item.title}
                      </p>
                      <p className="body-text mt-1 text-muted-foreground">
                        {item.text}
                      </p>
                    </li>
                  ))}
                </ul>
              </Block>

              <Block title="Stack technique">
                <dl className="flex flex-col gap-4">
                  {cv.stack.map((group) => (
                    <div key={group.title}>
                      <dt className="label text-ink">{group.title}</dt>
                      <dd className="body-text mt-1 text-muted-foreground">
                        {group.items.join(" · ")}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Block>
            </div>
          </div>

          <PixelPrintStrip />

          <div className="mt-12 flex flex-wrap gap-3 print:hidden">
            <PrintButton label="Imprimer / enregistrer en PDF" />
            <a
              href={`mailto:${site.email}`}
              className="label border border-rule px-4 py-3 text-muted-foreground transition-colors hover:border-ink hover:text-ink"
            >
              Me contacter
            </a>
          </div>
        </div>
      </main>

      <div className="print:hidden">
        <SiteFooter />
      </div>
    </>
  );
}
