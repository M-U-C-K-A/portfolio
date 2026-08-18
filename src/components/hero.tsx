import { PixelField } from "@/components/pixel-field";
import { PixelMark } from "@/components/pixel-mark";
import { hero, site } from "@/lib/content";

export function Hero() {
  return (
    <div>
      <div className="shell pb-8 pt-10 md:pb-10 md:pt-14">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-x-6">
          <h1 className="display display-xl lg:col-span-8">
            {hero.headline.map((line, index) => (
              <span key={line} className="block">
                {line}
                {index < hero.headline.length - 1 ? <br /> : null}
              </span>
            ))}
          </h1>

          <div className="flex flex-col gap-6 lg:col-span-4 lg:border-l lg:border-rule lg:pl-6 lg:pt-3">
            <div className="flex flex-col gap-1">
              {hero.labelRows.map((row, index) => (
                <div key={index} className="label-justified label text-ink">
                  {row.map((word) => (
                    <span key={word}>{word}</span>
                  ))}
                </div>
              ))}
            </div>

            <div className="flex items-start gap-4 border-t border-rule pt-5">
              <PixelMark className="mt-1 h-3 shrink-0 text-ink" />
              <p className="body-text max-w-sm text-muted-foreground">
                {hero.standfirst}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative border-y border-rule">
        <PixelField
          interactive
          introBlast
          cell={8}
          spawn={6}
          blastReach={0.3}
          seed={7}
          label="Grille de pixels interactive. Cliquez ou appuyez sur Entrée pour déclencher une explosion."
          className="bg-grid h-[54vh] min-h-[300px] w-full cursor-crosshair md:h-[62vh]"
        />
        <p
          aria-hidden
          className="label pointer-events-none absolute bottom-3 left-[var(--gutter)] text-muted-foreground"
        >
          {hero.hint}
        </p>
        <p
          aria-hidden
          className="label pointer-events-none absolute bottom-3 right-[var(--gutter)] hidden text-muted-foreground sm:block"
        >
          {site.location} — {site.timezone}
        </p>
      </div>
    </div>
  );
}
