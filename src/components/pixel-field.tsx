"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useTheme } from "@/hooks/use-theme";
import {
  PIXEL_PALETTE,
  PIXEL_PALETTE_DARK,
  PixelEngine,
  type PixelEngineOptions,
} from "@/lib/pixel-engine";
import { cn } from "@/lib/utils";

interface PixelFieldProps extends PixelEngineOptions {
  className?: string;
  /** Le champ réagit au curseur, au clic et au clavier. */
  interactive?: boolean;
  /** Explosion de démonstration peu après l'apparition. */
  introBlast?: boolean;
  /** Description pour les lecteurs d'écran. */
  label?: string;
}

export function PixelField({
  className,
  interactive = false,
  introBlast = false,
  label = "Champ de pixels animé",
  ...engineOptions
}: PixelFieldProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PixelEngine | null>(null);
  /** La configuration du moteur est figée au montage : elle décrit le champ,
   *  pas son état. Cela évite de recréer le moteur à chaque rendu du parent. */
  const [engineConfig] = useState(() => engineOptions);

  const reducedMotion = usePrefersReducedMotion();
  const { theme } = useTheme();
  const [motionOptIn, setMotionOptIn] = useState(false);

  const animate = !reducedMotion || motionOptIn;

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const engine = new PixelEngine(canvas, engineConfig);
    // Lu sur le DOM plutôt que sur l'état React : cet effet ne doit pas
    // dépendre du thème, sinon une bascule recréerait le moteur et
    // réinitialiserait le champ.
    engine.setPalette(
      document.documentElement.dataset.theme === "dark"
        ? PIXEL_PALETTE_DARK
        : PIXEL_PALETTE,
    );
    engineRef.current = engine;

    let visible = true;
    let intersecting = true;

    const applySize = () => {
      const rect = host.getBoundingClientRect();
      engine.resize(
        rect.width,
        rect.height,
        Math.min(window.devicePixelRatio || 1, 2),
      );
      if (!animate) engine.paintStill();
    };

    const sync = () => {
      // Un montage à taille nulle (onglet en arrière-plan, conteneur replié)
      // n'émet pas forcément de ResizeObserver ensuite : on remesure ici.
      if (!engine.hasSize) applySize();
      if (!animate) return;
      if (visible && intersecting) engine.start();
      else engine.stop();
    };

    applySize();

    const resizeObserver = new ResizeObserver(applySize);
    resizeObserver.observe(host);

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        intersecting = entry.isIntersecting;
        sync();
      },
      { rootMargin: "120px" },
    );
    intersectionObserver.observe(host);

    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      sync();
    };
    document.addEventListener("visibilitychange", onVisibility);

    sync();

    let introTimer: ReturnType<typeof setTimeout> | undefined;
    if (introBlast && animate) {
      introTimer = setTimeout(() => {
        const rect = host.getBoundingClientRect();
        engine.blast(rect.width * 0.62, rect.height * 0.52, 0.6);
      }, 1100);
    }

    return () => {
      if (introTimer) clearTimeout(introTimer);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      engine.destroy();
      engineRef.current = null;
    };
  }, [animate, engineConfig, introBlast]);

  // Bascule de thème : on repeint avec l'autre rampe, sans recréer le moteur.
  useEffect(() => {
    engineRef.current?.setPalette(
      theme === "dark" ? PIXEL_PALETTE_DARK : PIXEL_PALETTE,
    );
  }, [theme]);

  const localPoint = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!interactive || event.pointerType !== "mouse") return;
      const point = localPoint(event.clientX, event.clientY);
      if (point) engineRef.current?.pointerAt(point.x, point.y);
    },
    [interactive, localPoint],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!interactive) return;
      const point = localPoint(event.clientX, event.clientY);
      if (point) engineRef.current?.blast(point.x, point.y);
    },
    [interactive, localPoint],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!interactive) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      const rect = hostRef.current?.getBoundingClientRect();
      if (rect) engineRef.current?.blast(rect.width / 2, rect.height / 2);
    },
    [interactive],
  );

  return (
    <div
      ref={hostRef}
      className={cn("relative isolate overflow-hidden", className)}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => engineRef.current?.pointerLeave()}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      {...(interactive
        ? { role: "button" as const, tabIndex: 0, "aria-label": label }
        : { role: "presentation" as const, "aria-hidden": true })}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />

      {reducedMotion && !motionOptIn && interactive ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setMotionOptIn(true);
          }}
          className="label absolute bottom-3 left-3 z-10 border border-ink bg-paper px-2 py-1.5 text-ink transition-colors hover:bg-ink hover:text-paper"
        >
          Animation désactivée — activer
        </button>
      ) : null}
    </div>
  );
}
