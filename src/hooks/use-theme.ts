"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);

  // Le système peut changer pendant la session : on suit tant que
  // l'utilisateur n'a pas fait de choix explicite.
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    if (localStorage.getItem(THEME_STORAGE_KEY)) return;
    applyTheme(query.matches ? "dark" : "light");
  };
  query.addEventListener("change", onSystemChange);

  return () => {
    listeners.delete(onStoreChange);
    query.removeEventListener("change", onSystemChange);
  };
}

/** Le DOM fait foi : c'est le script bloquant du layout qui l'a posé. */
function getSnapshot(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** Au rendu serveur on suppose le clair ; le script corrige avant peinture. */
function getServerSnapshot(): Theme {
  return "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  notify();
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Navigation privée, stockage bloqué : le thème vaut pour la session.
    }
    applyTheme(next);
  }, []);

  return { theme, setTheme };
}
