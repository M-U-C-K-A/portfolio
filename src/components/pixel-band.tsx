import { PixelField } from "@/components/pixel-field";
import { cn } from "@/lib/utils";

interface PixelBandProps {
  seed: number;
  className?: string;
  caption?: string;
}

/** Interstitiel plein cadre : la grille respire seule et reste cliquable. */
export function PixelBand({ seed, className, caption }: PixelBandProps) {
  return (
    <div className="relative border-y border-rule">
      <PixelField
        interactive
        cell={8}
        spawn={5}
        seed={seed}
        blastReach={0.26}
        autoBlast={[4200, 9000]}
        label="Grille de pixels interactive. Cliquez ou appuyez sur Entrée pour déclencher une explosion."
        className={cn("bg-grid h-[38vh] min-h-[220px] w-full cursor-crosshair", className)}
      />
      {caption ? (
        <p
          aria-hidden
          className="label pointer-events-none absolute bottom-3 left-[var(--gutter)] text-muted-foreground"
        >
          {caption}
        </p>
      ) : null}
    </div>
  );
}
