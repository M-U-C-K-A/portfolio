"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Dernier filet : cette page remplace le layout racine, elle doit donc fournir
 * elle-même `<html>` et `<body>`. Aucun composant du site n'est réutilisé ici —
 * si le layout a échoué, rien ne garantit que le reste tienne.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erreur globale", error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="flex min-h-dvh flex-col justify-center bg-paper px-6 py-20 text-ink antialiased">
        <p className="label text-muted-foreground">Erreur</p>
        <h1 className="display display-l mt-6 max-w-2xl">
          Le site n’a pas pu se charger.
        </h1>
        <p className="body-text mt-6 max-w-md text-muted-foreground">
          L’erreur s’est produite avant même la mise en page. Recharger règle le
          problème dans la plupart des cas.
        </p>
        {error.digest ? (
          <p className="label mt-4 text-muted-foreground">
            Référence : {error.digest}
          </p>
        ) : null}
        <div className="mt-10 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="label border border-ink px-4 py-3 text-ink transition-colors hover:bg-ink hover:text-paper"
          >
            Recharger
          </button>
          {/* Navigation dure assumée : le routeur client fait partie de ce qui
              vient d'échouer, on ne lui confie pas la sortie de secours. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="label border border-rule px-4 py-3 text-muted-foreground transition-colors hover:border-ink hover:text-ink"
          >
            Retour à l’accueil
          </a>
        </div>
      </body>
    </html>
  );
}
