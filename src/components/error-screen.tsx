import type { ReactNode } from "react";
import { PixelField } from "@/components/pixel-field";
import type { PixelMotif } from "@/lib/pixel-engine";

interface ErrorScreenProps {
  /** Code affiché en libellé, « 404 » ou « 500 ». */
  code: string;
  title: string;
  description: string;
  /** Détail technique, montré uniquement quand il existe. */
  detail?: string;
  motif?: PixelMotif;
  seed?: number;
  children: ReactNode;
}

/**
 * Écran d'erreur partagé par les pages 404, 500 et l'erreur globale.
 * Il reprend la grille du site plutôt qu'une page nue : une erreur reste une
 * page du site, pas une sortie de route.
 */
export function ErrorScreen({
  code,
  title,
  description,
  detail,
  motif = "scan",
  seed = 404,
  children,
}: ErrorScreenProps) {
  return (
    <div className="shell flex grow flex-col justify-center py-20 md:py-28">
      <p className="label text-muted-foreground">Erreur {code}</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:gap-10">
        <h1 className="display display-xl lg:col-span-7">{title}</h1>
        <div className="flex flex-col gap-5 lg:col-span-4 lg:col-start-9 lg:border-l lg:border-rule lg:pl-8 lg:pt-3">
          <p className="body-text text-muted-foreground">{description}</p>
          {detail ? (
            <p className="label break-words border-l-2 border-px-accent bg-secondary/60 px-3 py-2 text-muted-foreground">
              {detail}
            </p>
          ) : null}
        </div>
      </div>

      <div className="bg-grid mt-12 border border-rule">
        <PixelField
          motif={motif}
          cell={8}
          seed={seed}
          className="h-32 w-full md:h-44"
        />
      </div>

      <div className="mt-10 flex flex-wrap gap-3">{children}</div>
    </div>
  );
}
