import { PixelField } from "@/components/pixel-field";
import { Section } from "@/components/section";
import { method } from "@/lib/content";

export function Method() {
  return (
    <Section id="methode" eyebrow="La méthode">
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
        <h2 className="display display-l lg:col-span-5">
          {method.title.map((word) => (
            <span key={word} className="block">
              {word}
            </span>
          ))}
        </h2>
        <p className="body-text max-w-xl text-muted-foreground lg:col-span-6 lg:col-start-7 lg:pt-2">
          {method.lead}
        </p>
      </div>

      {/* Zone non cliquable : elle porte un motif propre — un ruban qui
          s'écoule — pour ne pas paraître inerte à côté des grilles réactives. */}
      <div className="bg-grid mt-12 border border-rule md:mt-16">
        <PixelField
          motif="flow"
          cell={6}
          spawn={6}
          seed={41}
          className="h-40 w-full md:h-56"
        />
      </div>

      <div className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-4">
        {method.steps.map((step) => (
          <div key={step.index} className="flex flex-col gap-3 border-t border-rule pt-4">
            <div className="label-justified label text-muted-foreground">
              <span>{step.index}</span>
            </div>
            <h3 className="text-base font-medium tracking-tight">{step.name}</h3>
            <p className="body-text text-muted-foreground">{step.text}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
