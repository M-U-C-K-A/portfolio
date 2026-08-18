import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionProps {
  id?: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
  /** Filet supérieur — sépare les chapitres. */
  rule?: boolean;
}

export function Section({
  id,
  eyebrow,
  children,
  className,
  rule = true,
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "shell scroll-mt-11 py-16 md:py-24",
        rule && "border-t border-rule",
        className,
      )}
    >
      {eyebrow ? (
        <p className="label mb-10 text-muted-foreground md:mb-14">{eyebrow}</p>
      ) : null}
      {children}
    </section>
  );
}
