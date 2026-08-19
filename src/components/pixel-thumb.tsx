"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useTheme } from "@/hooks/use-theme";
import { PIXEL_PALETTE, PIXEL_PALETTE_DARK } from "@/lib/pixel-engine";
import { createPlate, paintPlate, type Plate } from "@/lib/pixel-plate";
import { cn } from "@/lib/utils";

interface PixelThumbProps {
  seed: number;
  /** Densifie la composition — piloté par le survol de la carte parente. */
  active?: boolean;
  cell?: number;
  className?: string;
}

export function PixelThumb({
  seed,
  active = false,
  cell = 5,
  className,
}: PixelThumbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const plateRef = useRef<Plate | null>(null);
  const revealRef = useRef(0);
  const targetRef = useRef(0);
  const rafRef = useRef(0);
  const reducedMotion = usePrefersReducedMotion();
  const { theme } = useTheme();

  useEffect(() => {
    targetRef.current = active ? 1 : 0;
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const plate = plateRef.current;
      if (plate) paintPlate(ctx, plate, revealRef.current);
    };

    const applySize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      plateRef.current = createPlate({
        width: rect.width,
        height: rect.height,
        cell,
        seed,
        palette: theme === "dark" ? PIXEL_PALETTE_DARK : PIXEL_PALETTE,
      });
      draw();
    };

    applySize();
    const observer = new ResizeObserver(applySize);
    observer.observe(canvas);

    const tick = () => {
      // Une taille nulle au montage n'émet pas toujours de ResizeObserver.
      if (!plateRef.current) applySize();

      const target = targetRef.current;
      const current = revealRef.current;
      const delta = target - current;
      if (Math.abs(delta) > 0.004) {
        revealRef.current = current + delta * (reducedMotion ? 1 : 0.16);
        draw();
      } else if (current !== target) {
        revealRef.current = target;
        draw();
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
      plateRef.current = null;
    };
  }, [cell, reducedMotion, seed, theme]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("block h-full w-full", className)}
    />
  );
}
