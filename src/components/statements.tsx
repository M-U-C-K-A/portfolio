import { statements } from "@/lib/content";

export function Statements() {
  return (
    <section id="points-de-vue" className="scroll-mt-11">
      {statements.map((statement) => (
        <div key={statement.eyebrow} className="shell border-t border-rule py-16 md:py-24">
          <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-5">
              <p className="label mb-6 text-muted-foreground">{statement.eyebrow}</p>
              <h2 className="display display-l max-w-xl">{statement.headline}</h2>
            </div>
            <div className="flex flex-col gap-4 lg:col-span-6 lg:col-start-7 lg:pt-1">
              {statement.body.map((paragraph) => (
                <p key={paragraph} className="body-text max-w-xl text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
