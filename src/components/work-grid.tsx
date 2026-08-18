import { Section } from "@/components/section";
import { WorkCard } from "@/components/work-card";
import { intro, projects } from "@/lib/content";

export function WorkGrid() {
  return (
    <Section id="projets" rule={false} className="pt-14 md:pt-20">
      <div className="grid gap-8 lg:grid-cols-12">
        <p className="body-text-l max-w-2xl lg:col-span-7 lg:col-start-4">
          {intro.lead}
        </p>
      </div>

      <div className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 md:mt-16 xl:grid-cols-4">
        {projects.map((project) => (
          <WorkCard key={project.slug} project={project} />
        ))}
      </div>
    </Section>
  );
}
