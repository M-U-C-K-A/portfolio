import { Section } from "@/components/section";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { education, experience, type TimelineEntry } from "@/lib/content";

function Entries({ entries, idPrefix }: { entries: TimelineEntry[]; idPrefix: string }) {
  return (
    <Accordion
      type="multiple"
      defaultValue={[`${idPrefix}-0`]}
      className="border-t border-rule"
    >
      {entries.map((entry, index) => (
        <AccordionItem
          key={entry.organisation}
          value={`${idPrefix}-${index}`}
          className="border-b border-rule"
        >
          <AccordionTrigger className="items-baseline py-5 hover:no-underline">
            <span className="flex flex-1 flex-col gap-1 pr-4 text-left sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
              <span className="text-base font-medium tracking-tight">
                {entry.organisation}
              </span>
              <span className="label shrink-0 text-muted-foreground">
                {entry.period}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-6">
            <p className="label mb-3 text-ink">{entry.role}</p>
            <ul className="flex flex-col gap-2">
              {entry.points.map((point) => (
                <li
                  key={point}
                  className="body-text flex gap-3 text-muted-foreground"
                >
                  <span aria-hidden className="mt-2 size-1 shrink-0 bg-px-accent" />
                  <span className="max-w-2xl">{point}</span>
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export function Timeline() {
  return (
    <Section id="parcours" eyebrow="Le parcours">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5">
          <h2 className="display display-l max-w-sm">Deux ans à construire des produits, pas des maquettes.</h2>
        </div>

        <div className="flex flex-col gap-12 lg:col-span-6 lg:col-start-7">
          <div>
            <p className="label mb-4 text-muted-foreground">Expériences</p>
            <Entries entries={experience} idPrefix="xp" />
          </div>
          <div>
            <p className="label mb-4 text-muted-foreground">Études</p>
            <Entries entries={education} idPrefix="edu" />
          </div>
        </div>
      </div>
    </Section>
  );
}
