"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { ProjectMedia } from "@/lib/content";

/**
 * Le carrousel d'un projet.
 *
 * En grille de deux colonnes, quatre captures occupaient deux pleines hauteurs
 * d'écran avant le premier mot du récit. Ici elles tiennent sur une bande, et
 * c'est le lecteur qui décide d'en voir plus.
 *
 * La bande a une **hauteur fixe** et chaque vue prend la largeur que lui donne
 * son rapport : une capture de téléphone est étroite, une capture de site est
 * large, et la ligne reste droite sans qu'on ait à trier les formats. Le
 * défilement est natif — `scroll-snap` fait le calage, les flèches ne font que
 * pousser la bande. Sans JavaScript le carrousel reste donc utilisable, au
 * doigt ou à la molette.
 */
export function ProjectShots({ shots }: { shots: ProjectMedia[] }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const drag = useRef<{ x: number; scroll: number } | null>(null);
  const [index, setIndex] = useState(0);
  const [overflows, setOverflows] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  /**
   * Positions des vues, mesurées à l'écran plutôt que dans le flux.
   *
   * `offsetLeft` ignore la gouttière que `scroll-padding` réintroduit au
   * calage ; un décalage lu sur le rendu reste juste quelle que soit la marge.
   */
  const offsets = () => {
    const track = trackRef.current;
    if (!track) return { pad: 0, lefts: [] as number[] };
    const base = track.getBoundingClientRect().left;
    return {
      pad: parseFloat(getComputedStyle(track).paddingLeft) || 0,
      lefts: [...track.children].map(
        (slide) => slide.getBoundingClientRect().left - base,
      ),
    };
  };

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setOverflows(track.scrollWidth - track.clientWidth > 4);

    // La vue courante est celle qui est calée sur le bord de la bande.
    const { pad, lefts } = offsets();
    let best = 0;
    let bestGap = Infinity;
    for (const [i, left] of lefts.entries()) {
      const gap = Math.abs(left - pad);
      if (gap < bestGap) {
        bestGap = gap;
        best = i;
      }
    }
    setIndex(best);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [measure]);

  const step = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    const { pad, lefts } = offsets();
    const target = Math.min(lefts.length - 1, Math.max(0, index + direction));
    if (lefts[target] === undefined) return;
    track.scrollBy({
      left: lefts[target] - pad,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  /**
   * Glissé latéral, à la souris seulement.
   *
   * Le tactile fait déjà défiler la bande, avec son inertie et son rebond ; s'y
   * superposer donnerait un défilement moins bon que celui du système. À la
   * souris en revanche il n'y a rien — une bande qui déborde sans barre est
   * muette, et l'utilisateur ne pense pas toujours à chercher les flèches.
   */
  const onPointerDown = (event: React.PointerEvent<HTMLUListElement>) => {
    const track = trackRef.current;
    if (!track || event.pointerType !== "mouse" || event.button !== 0) return;
    drag.current = { x: event.clientX, scroll: track.scrollLeft };
    // Posé sur le nœud plutôt que par un état React : le style doit tomber
    // avant le premier `pointermove`, et un rendu de retard suffit pour que le
    // navigateur recale la bande sous le curseur.
    track.dataset.dragging = "true";
    track.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLUListElement>) => {
    const track = trackRef.current;
    if (!drag.current || !track) return;
    track.scrollLeft = drag.current.scroll - (event.clientX - drag.current.x);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLUListElement>) => {
    const track = trackRef.current;
    if (!drag.current || !track) return;
    drag.current = null;
    if (track.hasPointerCapture(event.pointerId)) {
      track.releasePointerCapture(event.pointerId);
    }
    // Rendre le calage suffit à recaler : le navigateur le réapplique dès que
    // la propriété revient. Ajouter un défilement ici en faisait passer deux,
    // et la bande sautait une vue de trop.
    delete track.dataset.dragging;
  };

  if (shots.length === 0) return null;

  return (
    <section className="pt-10 [--shot-h:220px] md:pt-14 md:[--shot-h:360px] lg:[--shot-h:420px]">
      <div className="shell flex items-end justify-between gap-6">
        <p className="label text-muted-foreground">Aperçus</p>
        {overflows ? (
          <div className="flex items-center gap-4">
            <p className="label tabular-nums text-muted-foreground">
              {index + 1} / {shots.length}
            </p>
            <div className="flex">
              <button
                type="button"
                onClick={() => step(-1)}
                disabled={index === 0}
                aria-label="Vue précédente"
                className="flex size-9 items-center justify-center border border-rule transition-colors hover:border-ink disabled:opacity-30 disabled:hover:border-rule"
              >
                <span aria-hidden>←</span>
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                disabled={index >= shots.length - 1}
                aria-label="Vue suivante"
                className="-ml-px flex size-9 items-center justify-center border border-rule transition-colors hover:border-ink disabled:opacity-30 disabled:hover:border-rule"
              >
                <span aria-hidden>→</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <ul
        ref={trackRef}
        onScroll={measure}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="shots-track shell mt-6 flex gap-5 overflow-x-auto pb-1"
      >
        {shots.map((shot) => (
          <li
            key={shot.src}
            className="shrink-0 snap-start"
            style={{
              width: `min(84vw, calc(var(--shot-h) * ${shot.width / shot.height}))`,
            }}
          >
            <figure className="flex flex-col gap-3">
              <div
                className="bg-grid relative w-full overflow-hidden border border-rule"
                style={{ aspectRatio: `${shot.width} / ${shot.height}` }}
              >
                {shot.kind === "video" ? (
                  // Muette, en boucle, sans commande : elle remplace un GIF, elle
                  // ne demande pas à être pilotée.
                  <video
                    src={shot.src}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    className="size-full object-cover"
                  />
                ) : (
                  /* `alt=""` : la légende juste dessous dit ce que l'image montre. */
                  <Image
                    src={shot.src}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 60vw, 84vw"
                    className="object-cover"
                  />
                )}
              </div>
              <figcaption className="body-text text-muted-foreground">
                {shot.caption}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
