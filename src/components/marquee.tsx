import { cn } from "@/lib/utils";

interface MarqueeProps {
  text: string;
  repeat?: number;
  className?: string;
}

/**
 * Bandeau défilant. Le contenu est dupliqué à l'identique et la piste se
 * translate de -50 % : la boucle est continue quelle que soit la largeur.
 */
export function Marquee({ text, repeat = 4, className }: MarqueeProps) {
  const group = Array.from({ length: repeat }, (_, index) => (
    <span key={index} className="marquee-item">
      {text}
    </span>
  ));

  return (
    <div
      className={cn("overflow-hidden border-y border-rule py-3 md:py-5", className)}
    >
      <div className="marquee-track display text-[clamp(2.25rem,8.5vw,7.5rem)]">
        <div className="flex shrink-0">{group}</div>
        <div className="flex shrink-0" aria-hidden>
          {group}
        </div>
      </div>
    </div>
  );
}
