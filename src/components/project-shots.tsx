"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { ProjectMedia } from "@/lib/content";

/** Délai de secours si `scrollend` n'existe pas, ou si rien n'a bougé. */
const SETTLE_FALLBACK = 600;
/**
 * Vitesse à partir de laquelle un geste bref fait quand même passer une vue,
 * en px/ms.
 *
 * Sans ce seuil, une chiquenaude ne déplace la bande que de quelques dizaines
 * de pixels et le calage la ramène d'où elle vient : on a l'impression qu'elle
 * résiste. Le tactile a son inertie native, la souris n'en a aucune.
 *
 * Mesuré sur de vrais événements souris : un geste posé tourne autour de
 * 0,25 px/ms, une chiquenaude dépasse 1,5. Le seuil tient au milieu, et il vaut
 * mieux qu'il soit un peu haut — une vue qui passe sans qu'on l'ait voulu est
 * plus désagréable qu'une vue qui ne passe pas.
 */
const FLICK_VELOCITY = 0.45;

/**
 * Le carrousel d'un projet.
 *
 * En grille de deux colonnes, quatre captures occupaient deux pleines hauteurs
 * d'écran avant le premier mot du récit. Ici elles tiennent sur une bande, et
 * c'est le lecteur qui décide d'en voir plus.
 *
 * La bande a une **hauteur fixe** et chaque vue prend la largeur que lui donne
 * son rapport : une capture de téléphone est étroite, une capture de site est
 * large, et la ligne reste droite sans qu'on ait à trier les formats.
 *
 * Le défilement est natif — `scroll-snap` fait le calage, les flèches et le
 * glissé ne font que pousser la bande. Sans JavaScript le carrousel reste donc
 * utilisable, au doigt comme à la molette.
 */
export function ProjectShots({ shots }: { shots: ProjectMedia[] }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const drag = useRef<{
    x: number;
    scroll: number;
    time: number;
    /** Vue calée au départ du geste, pour savoir d'où compter une vue. */
    from: number;
    /** Vitesse lissée du geste, en px/ms. Négative vers la gauche. */
    velocity: number;
  } | null>(null);
  /**
   * Gouttière de la bande, relue au redimensionnement seulement.
   *
   * Elle servait à être lue à chaque événement de défilement, ce qui force un
   * recalcul de style par image pendant le glissé — c'est ce qui rendait le
   * geste poussif.
   */
  const gutter = useRef(0);
  const pending = useRef(0);
  const settling = useRef<(() => void) | null>(null);
  const [index, setIndex] = useState(0);
  const [overflows, setOverflows] = useState(false);
  // Les bornes se lisent sur la position, pas sur l'indice : plusieurs vues
  // peuvent partager le dernier arrêt.
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  /**
   * Position de défilement qui cale chaque vue sur le bord de la bande.
   *
   * `offsetLeft` se lit dans l'arbre de mise en page déjà calculé, là où
   * `getBoundingClientRect` en force le recalcul. La gouttière est retranchée
   * parce que `scroll-padding-inline` l'ajoute au calage.
   *
   * Les positions sont bornées à la course réelle : quand les dernières vues
   * sont plus étroites que le débord, elles apparaissent toutes ensemble à la
   * fin et leurs arrêts sont hors d'atteinte. Sans cette borne, le bouton
   * suivant reste actif et ne fait plus rien.
   */
  const targets = (track: HTMLUListElement) => {
    const furthest = Math.max(0, track.scrollWidth - track.clientWidth);
    return [...track.children].map((slide) =>
      Math.min(furthest, Math.max(0, (slide as HTMLElement).offsetLeft - gutter.current)),
    );
  };

  const nearest = (from: { scrollLeft: number }, stops: number[]) => {
    let best = 0;
    let bestGap = Infinity;
    for (const [i, stop] of stops.entries()) {
      const gap = Math.abs(stop - from.scrollLeft);
      if (gap < bestGap) {
        bestGap = gap;
        best = i;
      }
    }
    return best;
  };

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const furthest = track.scrollWidth - track.clientWidth;
    setOverflows(furthest > 4);
    setAtStart(track.scrollLeft <= 1);
    setAtEnd(track.scrollLeft >= furthest - 1);
    setIndex(nearest(track, targets(track)));
  }, []);

  // Le défilement émet plusieurs événements par image ; une mesure par image
  // suffit à tenir le compteur à jour.
  const onScroll = () => {
    if (pending.current) return;
    pending.current = requestAnimationFrame(() => {
      pending.current = 0;
      measure();
    });
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const remeasure = () => {
      gutter.current = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      measure();
    };
    remeasure();
    const observer = new ResizeObserver(remeasure);
    observer.observe(track);
    return () => {
      observer.disconnect();
      if (pending.current) cancelAnimationFrame(pending.current);
    };
  }, [measure]);

  const goTo = (target: number) => {
    const track = trackRef.current;
    if (!track) return;
    const stops = targets(track);
    const clamped = Math.min(stops.length - 1, Math.max(0, target));
    track.scrollTo({
      left: stops[clamped],
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
    // Sans cela le navigateur démarre son propre glisser-déposer sur l'image
    // ou une sélection de texte, et le geste part une fois sur deux.
    event.preventDefault();
    settling.current?.();
    drag.current = {
      x: event.clientX,
      scroll: track.scrollLeft,
      time: event.timeStamp,
      from: nearest(track, targets(track)),
      velocity: 0,
    };
    // Posé sur le nœud plutôt que par un état React : le style doit tomber
    // avant le premier `pointermove`, et un rendu de retard suffit pour que le
    // navigateur recale la bande sous le curseur.
    track.dataset.dragging = "true";
    track.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLUListElement>) => {
    const track = trackRef.current;
    const state = drag.current;
    if (!state || !track) return;

    const elapsed = event.timeStamp - state.time;
    if (elapsed > 0) {
      const before = track.scrollLeft;
      track.scrollLeft = state.scroll - (event.clientX - state.x);
      // Lissée sur quelques événements : une seule mesure suffit à faire partir
      // la bande de travers si la souris a tremblé au moment du relâchement.
      const instant = (track.scrollLeft - before) / elapsed;
      state.velocity = state.velocity * 0.7 + instant * 0.3;
      state.time = event.timeStamp;
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLUListElement>) => {
    const track = trackRef.current;
    if (!drag.current || !track) return;
    const { velocity, from: start } = drag.current;
    drag.current = null;
    if (track.hasPointerCapture(event.pointerId)) {
      track.releasePointerCapture(event.pointerId);
    }

    // On glisse jusqu'à la vue la plus proche, puis on rend le calage. Dans
    // l'autre ordre la bande saute d'un coup sec : le navigateur recale sans
    // animation dès que la propriété revient, et le glissé qu'on ajouterait
    // ensuite ferait passer une vue de trop.
    // On vise là où le geste allait, pas seulement là où il s'est arrêté : une
    // chiquenaude franche fait passer une vue même si elle n'a pas parcouru la
    // moitié de la largeur. Si le geste est allé plus loin que ça, c'est lui
    // qui gagne — on ne ramène jamais la bande en arrière de son propre élan.
    const stops = targets(track);
    const closest = nearest(track, stops);
    const flicked = Math.abs(velocity) > FLICK_VELOCITY;
    const forward = velocity > 0;
    const aimed = flicked
      ? forward
        ? Math.max(closest, start + 1)
        : Math.min(closest, start - 1)
      : closest;
    const target = Math.min(stops.length - 1, Math.max(0, aimed));
    setIndex(target);

    const done = () => {
      if (settling.current !== done) return;
      settling.current = null;
      track.removeEventListener("scrollend", done);
      delete track.dataset.dragging;
    };
    settling.current = done;
    track.addEventListener("scrollend", done);
    window.setTimeout(done, SETTLE_FALLBACK);

    track.scrollTo({
      left: stops[target],
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  if (shots.length === 0) return null;

  return (
    <section className="pt-10 [--shot-h:220px] md:pt-14 md:[--shot-h:360px] lg:[--shot-h:420px]">
      <div className="shell flex items-end justify-between gap-6">
        <p className="label text-muted-foreground">Aperçus</p>
        {overflows ? (
          <div className="flex items-center gap-4">
            <p className="label text-muted-foreground tabular-nums">
              {index + 1} / {shots.length}
            </p>
            <div className="flex">
              <button
                type="button"
                onClick={() => goTo(index - 1)}
                disabled={atStart}
                aria-label="Vue précédente"
                className="flex size-9 items-center justify-center border border-rule transition-colors hover:border-ink disabled:opacity-30 disabled:hover:border-rule"
              >
                <span aria-hidden>←</span>
              </button>
              <button
                type="button"
                onClick={() => goTo(index + 1)}
                disabled={atEnd}
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
        onScroll={onScroll}
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
                className="bg-grid relative w-full select-none overflow-hidden border border-rule"
                style={{ aspectRatio: `${shot.width} / ${shot.height}` }}
              >
                {shot.kind === "video" ? (
                  // Muette, en boucle, sans commande : elle remplace un GIF,
                  // elle ne demande pas à être pilotée.
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
                  /* `alt=""` : la légende juste dessous dit ce que l'image
                     montre. `draggable` coupe le glisser-déposer natif, qui
                     détournerait le geste dès qu'il part sur une image. */
                  <Image
                    src={shot.src}
                    alt=""
                    fill
                    draggable={false}
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
